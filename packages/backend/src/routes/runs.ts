import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { getChannel, QUEUE_RUN_TEST } from '../lib/rabbitmq.js';
import { logger } from '../lib/logger.js';
import { OUTPUT_TYPES } from '@tenjint6/shared';
import type { OutputConfig } from '@tenjint6/shared';
import { extractCsvFiles } from './utils.js';

export const runRoutes = Router();

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val ?? {};
}

function extractOptionsFromScript(scriptContent: string): Record<string, unknown> {
  const load: Record<string, unknown> = {};

  // Only look inside export const options = { ... }
  const block = scriptContent.match(/export\s+(?:const|let|var)\s+options\s*=\s*\{([\s\S]*?)\};/);
  if (!block) return load;

  const body = block[1];

  // Check for scenarios FIRST — if present, return early; the script itself
  // contains the full scenario definition inline so no CLI flags are needed.
  if (/\bscenarios\s*:\s*\{/.test(body)) {
    load.scenarios = true;
    return load;
  }

  // Check for stages array next — if present, extract stages and return.
  // Flat vus/duration/iterations should NOT be extracted from inside stage
  // objects (e.g. { duration: '30s', target: 5 } would pollute load.duration).
  if (/\bstages\s*:/.test(body)) {
    const stageRegex = /\{\s*duration:\s*['"]([^'"]+)['"],\s*target:\s*(\d+)\s*\}/g;
    const stages: { duration: string; target: number }[] = [];
    let m;
    while ((m = stageRegex.exec(body)) !== null) {
      stages.push({ duration: m[1], target: parseInt(m[2], 10) });
    }
    if (stages.length > 0) load.stages = stages;
    return load;
  }

  // Only extract flat vus/duration/iterations when no stages or scenarios
  const vusMatch = body.match(/\bvus\s*:\s*(\d+)/);
  if (vusMatch) load.vus = parseInt(vusMatch[1], 10);

  const durMatch = body.match(/\bduration\s*:\s*['"](\d+[smh])['"]/);
  if (durMatch) load.duration = durMatch[1];

  const iterMatch = body.match(/\biterations\s*:\s*(\d+)/);
  if (iterMatch) load.iterations = parseInt(iterMatch[1], 10);

  return load;
}

/**
 * @openapi
 * /configs/{id}/run:
 *   post:
 *     tags: [Runs]
 *     summary: Trigger a test run from a config
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Test run created and enqueued
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestRun'
 *       404:
 *         description: Config not found
 */
runRoutes.post('/configs/:id/run', async (req: Request, res: Response) => {
  const configId = req.params.id as string;
  const config = await prisma.testConfig.findUnique({
    where: { id: configId },
    include: { script: { select: { id: true, projectId: true, content: true, envVars: true } } },
  });
  if (!config) { res.status(404).json({ message: 'Config not found' }); return; }

  let parsedOptions: Record<string, unknown> = {};
  try { parsedOptions = typeof config.options === 'string' ? JSON.parse(config.options) : config.options as any; } catch { parsedOptions = {}; }

  // Check if script has inline scenarios
  const scriptOptions = extractOptionsFromScript(config.script.content);
  const hasScriptScenarios = scriptOptions.scenarios !== undefined || config.script.content.includes('scenarios:');

  if (hasScriptScenarios) {
    // If the script has scenarios defined, ignore load profile and scenarios from the config file,
    // keeping ONLY thresholds, env, and output configuration
    delete parsedOptions.vus;
    delete parsedOptions.duration;
    delete parsedOptions.iterations;
    delete parsedOptions.stages;
    delete parsedOptions.scenarios;
  } else {
    if (parsedOptions.vus === undefined && scriptOptions.vus !== undefined) parsedOptions.vus = scriptOptions.vus;
    if (parsedOptions.duration === undefined && scriptOptions.duration !== undefined) parsedOptions.duration = scriptOptions.duration;
    if (parsedOptions.iterations === undefined && scriptOptions.iterations !== undefined) parsedOptions.iterations = scriptOptions.iterations;
    if (parsedOptions.stages === undefined && scriptOptions.stages !== undefined) parsedOptions.stages = scriptOptions.stages;
    if (parsedOptions.scenarios === undefined && scriptOptions.scenarios !== undefined) parsedOptions.scenarios = scriptOptions.scenarios;
  }

  // Merge script envVars + config env + selected environment variables
  const scriptEnvVars: Record<string, string> = safeJson(config.script.envVars);
  const configEnv: Record<string, string> = (parsedOptions.env as Record<string, string>) || {};
  const mergedEnv = { ...scriptEnvVars, ...configEnv };

  // Resolve environment: use specific one from request body, or fall back to default
  const envId = req.body?.environmentId as string | undefined;
  const resolvedEnv = envId
    ? await prisma.environment.findUnique({ where: { id: envId } })
    : await prisma.environment.findFirst({ where: { projectId: config.script.projectId, isDefault: true } });
  if (resolvedEnv) {
    const envVars: Record<string, string> = safeJson(resolvedEnv.variables);
    if (resolvedEnv.baseUrl) envVars.TARGET_URL = resolvedEnv.baseUrl;
    Object.assign(mergedEnv, envVars);
  }

  parsedOptions.env = mergedEnv;

  // Resolve OutputProfile: use config's linked output profile, or fall back to project default profile
  const resolvedProfile = (config as any).outputProfile || await prisma.outputProfile.findFirst({
    where: { projectId: config.script.projectId, isDefault: true },
  });
  if (resolvedProfile) {
    let profileConfig: Record<string, string> = {};
    try { profileConfig = JSON.parse(resolvedProfile.configJson); } catch {}
    if (!Array.isArray(parsedOptions.outputs)) parsedOptions.outputs = [];
    const existingIdx = (parsedOptions.outputs as OutputConfig[]).findIndex(o => o.type === resolvedProfile.outputType);
    if (existingIdx === -1) {
      (parsedOptions.outputs as OutputConfig[]).push({
        type: resolvedProfile.outputType,
        enabled: true,
        config: profileConfig,
      });
    } else if (!(parsedOptions.outputs as OutputConfig[])[existingIdx].config?.url) {
      (parsedOptions.outputs as OutputConfig[])[existingIdx].config = {
        ...(parsedOptions.outputs as OutputConfig[])[existingIdx].config,
        ...profileConfig,
      };
      (parsedOptions.outputs as OutputConfig[])[existingIdx].enabled = true;
    }
  }

  // Inject env vars needed by output types (API keys, tokens, etc.)
  const outputs = (parsedOptions.outputs as OutputConfig[]) || [];
  for (const out of outputs) {
    if (!out.enabled) continue;
    const info = OUTPUT_TYPES[out.type];
    if (!info) continue;

    if (out.type === 'cloud') {
      const project = await prisma.project.findUnique({
        where: { id: config.script.projectId },
        select: { k6CloudToken: true },
      });
      if (project?.k6CloudToken) mergedEnv.K6_CLOUD_TOKEN = project.k6CloudToken;
    }

    // Inject mapped env vars from output config
    if (info.envMap) {
      for (const [fieldKey, envVarName] of Object.entries(info.envMap)) {
        const val = out.config[fieldKey];
        if (val) mergedEnv[envVarName] = val;
      }
    }
  }

  // Replace __TARGET_URL__ placeholders in script content
  let scriptContent = config.script.content;
  if (mergedEnv.TARGET_URL) {
    scriptContent = scriptContent.replace(/__TARGET_URL__/g, mergedEnv.TARGET_URL);
  }

  // Inject thresholds from config into the script (k6 has no --thresholds CLI flag)
  const configThresholds = (parsedOptions.thresholds as Record<string, string[]>) || {};
  if (Object.keys(configThresholds).length > 0) {
    const thresholdBlock = Object.entries(configThresholds)
      .map(([metric, rules]) => `      '${metric}': [${rules.map(r => `'${r}'`).join(', ')}],`)
      .join('\n');

    const hasThresholdsInScript = /thresholds\s*:/.test(scriptContent);
    const optMatch = scriptContent.match(/(export\s+(?:const|let|var)\s+options\s*=\s*\{)/);
    if (optMatch && !hasThresholdsInScript) {
      const start = optMatch.index! + optMatch[1].length - 1; // pos of the opening `{`
      let depth = 1;
      let end = -1;
      for (let i = start + 1; i < scriptContent.length; i++) {
        const ch = scriptContent[i];
        if (ch === '{') depth++;
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break; } }
      }
      if (end > 0) {
        const before = scriptContent.slice(start + 1, end);
        // Strip trailing comma / whitespace from last property if present
        const trimmed = before.replace(/,\s*$/, '');
        const sep = trimmed.trim() ? ',\n' : '\n';
        scriptContent = scriptContent.slice(0, start + 1) + trimmed + sep +
          `    thresholds: {\n${thresholdBlock}\n    }` + scriptContent.slice(end);
      }
    } else if (!optMatch) {
      const insertPoint = scriptContent.indexOf('export default');
      const thunk = `export const options = {\n  thresholds: {\n${thresholdBlock}\n  },\n};\n\n`;
      if (insertPoint >= 0) {
        scriptContent = scriptContent.slice(0, insertPoint) + thunk + scriptContent.slice(insertPoint);
      } else {
        scriptContent += '\n\n' + thunk;
      }
    }
  }

  const userId = req.user?.userId || '00000000-0000-0000-0000-000000000000';

  const run = await prisma.testRun.create({
    data: {
      testConfigId: config.id,
      scriptId: config.script.id,
      projectId: config.script.projectId,
      userId,
      status: 'pending',
      optionsSnapshot: JSON.stringify(parsedOptions),
    },
  });

  // Detect CSV file references and fetch content
  const csvFiles = await extractCsvFiles(scriptContent);

  // Enqueue job for worker
  const channel = getChannel();
  channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify({
    runId: run.id,
    projectId: config.script.projectId,
    scriptContent,
    options: parsedOptions,
    csvFiles: csvFiles.length > 0 ? csvFiles : undefined,
    prometheusPushUrl: config.prometheusPushUrl ?? undefined,
  })), { persistent: true });

  logger.info({ runId: run.id }, 'Test run triggered');
  res.status(201).json(run);
});

/**
 * @openapi
 * /runs:
 *   get:
 *     tags: [Runs]
 *     summary: List test runs with optional filtering
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema: { type: string, format: uuid }
 *         description: Filter by project ID
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *         description: Filter by run status
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 50 }
 *         description: Max results (capped at 100)
 *     responses:
 *       200:
 *         description: List of test runs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/TestRun' }
 */
runRoutes.get('/runs', async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string | undefined;
  const status = req.query.status as string | undefined;
  const suiteRunId = req.query.suiteRunId as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const scriptId = req.query.scriptId as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  const where: Record<string, unknown> = {};
  if (projectId) where.projectId = projectId;
  if (status) where.status = status;
  if (suiteRunId) where.suiteRunId = suiteRunId;
  if (scriptId) where.scriptId = scriptId;
  if (dateFrom || dateTo) {
    const createdAt: Record<string, Date> = {};
    if (dateFrom) createdAt.gte = new Date(dateFrom);
    if (dateTo) createdAt.lte = new Date(dateTo);
    where.createdAt = createdAt;
  }

  const runs = await prisma.testRun.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      script: { select: { name: true } },
      config: { select: { name: true } },
    },
  });
  res.json(runs);
});

/**
 * @openapi
 * /runs/{id}:
 *   get:
 *     tags: [Runs]
 *     summary: Get a single test run with results
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Test run details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TestRun'
 *       404:
 *         description: Run not found
 */
runRoutes.get('/runs/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({
    where: { id },
    include: {
      results: true,
      thresholdResults: true,
      script: { select: { name: true } },
      config: { select: { name: true } },
    },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }
  res.json(run);
});

/**
 * @openapi
 * /runs/{id}/abort:
 *   post:
 *     tags: [Runs]
 *     summary: Abort a running test
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Abort signal sent
 *       400:
 *         description: Run is not running
 *       404:
 *         description: Run not found
 */
/**
 * @openapi
 * /runs/{id}/notes:
 *   patch:
 *     tags: [Runs]
 *     summary: Update notes on a test run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes: { type: string }
 *     responses:
 *       200:
 *         description: Notes updated
 */
runRoutes.patch('/runs/:id/notes', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { notes } = req.body;
  const run = await prisma.testRun.update({
    where: { id },
    data: { notes },
    select: { id: true, notes: true },
  });
  res.json(run);
});

runRoutes.delete('/runs/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.testRun.delete({ where: { id } });
  res.json({ message: 'Run deleted' });
});

runRoutes.post('/runs/:id/abort', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const run = await prisma.testRun.findUnique({ where: { id } });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  if (run.status !== 'running') {
    res.status(400).json({ message: 'Run is not running' });
    return;
  }

  const channel = getChannel();
  channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify({
    type: 'abort',
    runId: run.id,
  })));

  // Also abort on distributed worker agents if assigned
  const assignments = await prisma.workerRunAssignment.findMany({
    where: { runId: run.id, status: 'running' },
  });
  if (assignments.length > 0) {
    const workerIds = assignments.map(a => a.workerId);
    const workers = await prisma.worker.findMany({ where: { id: { in: workerIds } } });
    for (const w of workers) {
      if (w.url) {
        fetch(`${w.url}/abort`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ runId: run.id }),
        }).catch(() => {});
      }
    }
    await prisma.workerRunAssignment.updateMany({
      where: { runId: run.id, status: 'running' },
      data: { status: 'aborted', finishedAt: new Date() },
    });
  }

  await prisma.testRun.updateMany({
    where: { id: run.id },
    data: { status: 'aborted', finishedAt: new Date() },
  });

  res.json({ message: 'Abort signal sent' });
});

/**
 * @openapi
 * /runs/{id}/results:
 *   get:
 *     tags: [Runs]
 *     summary: Get aggregated test results for a run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Test results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/TestResult' }
 */
runRoutes.get('/runs/:id/results', async (req: Request, res: Response) => {
  const testRunId = req.params.id as string;
  const results = await prisma.testResult.findMany({
    where: { testRunId },
  });
  res.json(results);
});

/**
 * @openapi
 * /runs/{id}/thresholds:
 *   get:
 *     tags: [Runs]
 *     summary: Get threshold results for a run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Threshold results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ThresholdResult' }
 */
runRoutes.get('/runs/:id/thresholds', async (req: Request, res: Response) => {
  const testRunId = req.params.id as string;
  const thresholds = await prisma.thresholdResult.findMany({
    where: { testRunId },
  });
  res.json(thresholds);
});

/**
 * @openapi
 * /runs/{id}/log:
 *   get:
 *     tags: [Runs]
 *     summary: Get log points for a run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Time-series log points
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/TestResultPoint' }
 */
runRoutes.get('/runs/:id/log', async (req: Request, res: Response) => {
  const testRunId = req.params.id as string;
  const points = await prisma.testResultPoint.findMany({
    where: { testRunId },
    orderBy: { timestamp: 'asc' },
    take: 1000,
  });
  res.json(points);
});

/**
 * @openapi
 * /runs/{id}/request-logs:
 *   get:
 *     tags: [Runs]
 *     summary: Get per-request logs for a test run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Request logs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string }
 *                   method: { type: string }
 *                   url: { type: string }
 *                   status: { type: integer }
 *                   body: { type: string }
 *                   headers: { type: string }
 *                   timing: { type: number }
 *                   timestamp: { type: string }
 */
runRoutes.get('/runs/:id/request-logs', async (req: Request, res: Response) => {
  const testRunId = req.params.id as string;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const pageSize = Math.min(500, Math.max(1, parseInt(req.query.pageSize as string) || 50));
  const skip = (page - 1) * pageSize;

  const [logs, total] = await Promise.all([
    prisma.testRequestLog.findMany({
      where: { testRunId },
      orderBy: { timestamp: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.testRequestLog.count({ where: { testRunId } }),
  ]);
  res.json({ logs, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
});

/**
 * @openapi
 * /runs/{id}/cloud-sync:
 *   post:
 *     tags: [Runs]
 *     summary: Sync k6 Cloud run ID/URL and optionally fetch cloud results
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cloudRunId: { type: string }
 *               cloudRunUrl: { type: string }
 *     responses:
 *       200:
 *         description: Cloud sync completed
 *       404:
 *         description: Run not found
 */
runRoutes.post('/runs/:id/cloud-sync', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { cloudRunId, cloudRunUrl } = req.body as { cloudRunId?: string; cloudRunUrl?: string };

  const run = await prisma.testRun.findUnique({
    where: { id },
    include: { project: { select: { k6CloudToken: true } } },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  const update: Record<string, unknown> = {};
  if (cloudRunId) update.cloudRunId = cloudRunId;
  if (cloudRunUrl) update.cloudRunUrl = cloudRunUrl;

  // If we have a cloud run ID and cloud token, fetch results from k6 Cloud API
  if (cloudRunId && run.project.k6CloudToken) {
    try {
      const cloudResp = await fetch(
        `https://api.k6.io/v3/test-runs/${cloudRunId}/metrics`,
        { headers: { Authorization: `Token ${run.project.k6CloudToken}` } },
      );
      if (cloudResp.ok) {
        const cloudData = await cloudResp.json();
        update.cloudResults = JSON.stringify(cloudData);

        // Store returned metrics as TestResult records
        if (Array.isArray(cloudData.metrics)) {
          for (const m of cloudData.metrics) {
            await prisma.testResult.upsert({
              where: { id: `${id}-cloud-${m.name || m.metric}` },
              update: {
                avg: m.avg ?? m.value,
                min: m.min,
                max: m.max,
                p90: m.p90,
                p95: m.p95,
                p99: m.p99,
                count: m.count,
              },
              create: {
                id: `${id}-cloud-${m.name || m.metric}`,
                testRunId: id,
                metricName: m.name || m.metric,
                metricType: m.type || 'trend',
                avg: m.avg ?? m.value,
                min: m.min,
                max: m.max,
                p90: m.p90,
                p95: m.p95,
                p99: m.p99,
                count: m.count,
              },
            });
          }
        }
      }
    } catch (err) {
      logger.error({ err, cloudRunId }, 'Failed to fetch k6 Cloud results');
    }
  }

  const updated = await prisma.testRun.update({ where: { id }, data: update });
  res.json({
    cloudRunId: updated.cloudRunId,
    cloudRunUrl: updated.cloudRunUrl,
    cloudResults: safeJson(updated.cloudResults),
  });
});
