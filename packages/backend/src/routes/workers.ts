import { Router, Request, Response } from 'express';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { resultIngester } from '../workers/index.js';
import { extractCsvFiles } from './utils.js';
import { broadcastMetric } from './ws.js';
import { k8sManager } from '../lib/k8s.js';

export const workerRoutes = Router();

// Track locally-spawned agent processes
const spawnedAgents = new Map<string, ChildProcess>();

function safeJson(val: any, fallback: any = {}): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return fallback; } }
  return val ?? fallback;
}

function extractToken(req: Request): string {
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7) : '';
}

async function getProjectK8sConfig(projectId: string): Promise<{ namespace: string; image: string; imagePullPolicy: string } | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId }, select: { k8sConfig: true } });
  if (!project?.k8sConfig) return null;
  const cfg = safeJson(project.k8sConfig);
  if (!cfg?.namespace) return null;
  return {
    namespace: cfg.namespace || 'default',
    image: cfg.image || 'tenjint6/worker-agent:latest',
    imagePullPolicy: cfg.imagePullPolicy || 'Always',
  };
}

// ── Worker CRUD ──────────────────────────────────────────

workerRoutes.get('/projects/:pid/workers', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const workers = await prisma.worker.findMany({
    where: { projectId: pid },
    include: { _count: { select: { assignments: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(workers);
});

workerRoutes.post('/projects/:pid/workers', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const { name, url, capacity, launchType, namespace } = req.body;
  const worker = await prisma.worker.create({
    data: {
      projectId: pid,
      name,
      url,
      capacity: capacity || 100,
      status: 'offline',
      launchType: launchType || 'local',
      namespace: namespace || 'default',
    },
  });
  res.status(201).json(worker);
});

workerRoutes.patch('/workers/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const worker = await prisma.worker.update({ where: { id }, data: req.body });
  res.json(worker);
});

workerRoutes.delete('/workers/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.worker.delete({ where: { id } });
  res.json({ message: 'Worker deleted' });
});

// ── Heartbeat (name-based for agents that don't know DB ID) ──

async function handleHeartbeat(req: Request, res: Response) {
  const name = (req.body?.name || req.params?.name) as string;
  const { status, activeRuns, cpuPercent, memoryMb, memoryPercent } = req.body || {};
  if (!name) { res.status(400).json({ message: 'name is required' }); return; }

  const worker = await prisma.worker.findFirst({ where: { name } });
  if (!worker) { res.status(404).json({ message: 'Worker not found. Register it first via the UI or API.' }); return; }

  const updated = await prisma.worker.update({
    where: { id: worker.id },
    data: { status: status || 'online', lastHeartbeat: new Date() },
  });

  const cpuStr = cpuPercent !== undefined ? ` | CPU: ${cpuPercent}%` : '';
  const memStr = memoryMb !== undefined ? ` | RAM: ${memoryMb}MB (${memoryPercent ?? 0}%)` : '';
  const runsStr = ` | Active Runs: ${activeRuns ?? 0}`;
  logger.info(`[Worker Heartbeat] 🟢 "${name}" (${worker.url || 'local'}) -> status: ${updated.status}${runsStr}${cpuStr}${memStr}`);

  res.json({ message: 'Heartbeat received', worker: updated });
}

workerRoutes.post('/workers/heartbeat', handleHeartbeat);
workerRoutes.post('/workers/:name/heartbeat', handleHeartbeat);

// ── Start/Stop agent processes ────────────────────────────

const WORKER_AGENT_ENTRY = path.resolve(import.meta.dirname, '../../../worker-agent/src/index.ts');

workerRoutes.post('/workers/:id/start', async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }

  // Extract port from worker URL (e.g. http://localhost:6566 → 6566)
  let port = 6566;
  try {
    const parsed = new URL(worker.url);
    port = parseInt(parsed.port, 10) || 6566;
  } catch { /* use default */ }

  const centralUrl = `${req.protocol}://${req.hostname}:${process.env.PORT || '3001'}`;

  if (worker.launchType === 'kubernetes') {
    const k8sCfg = await getProjectK8sConfig(worker.projectId);
    if (!k8sCfg) {
      res.status(400).json({ message: 'Kubernetes not configured for this project. Go to Project Settings to set it up.' });
      return;
    }

    await k8sManager.init(k8sCfg);
    if (!k8sManager.isAvailable()) {
      res.status(500).json({ message: 'Kubernetes client not available — check kubeconfig on the backend server' });
      return;
    }

    try {
      const podInfo = await k8sManager.launchWorker(worker.name, port, centralUrl, k8sCfg);
      await prisma.worker.update({
        where: { id },
        data: { status: 'running', namespace: k8sCfg.namespace },
      });
      logger.info({ workerId: id, name: worker.name, podInfo, centralUrl }, 'K8s worker pod launched');
      res.json({ message: `Worker "${worker.name}" deployed as K8s pod "${podInfo.podName}" in namespace "${podInfo.namespace}"`, launchType: 'kubernetes' });
    } catch (err: any) {
      logger.error({ err, workerId: id }, 'Failed to launch K8s worker pod');
      res.status(500).json({ message: `Failed to launch K8s pod: ${err.message}` });
    }
  } else {
    // Local spawn
    if (spawnedAgents.has(id) && !spawnedAgents.get(id)!.killed) {
      res.status(409).json({ message: 'Worker agent is already running locally' });
      return;
    }

    logger.info({ workerId: id, name: worker.name, port, centralUrl }, 'Starting local worker agent');

    const agent = spawn('npx', ['tsx', WORKER_AGENT_ENTRY], {
      cwd: path.resolve(import.meta.dirname, '../../../worker-agent'),
      env: {
        ...process.env,
        AGENT_NAME: worker.name,
        AGENT_PORT: String(port),
        CENTRAL_API_URL: centralUrl,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    agent.stdout?.on('data', (data: Buffer) => {
      logger.info({ workerId: id }, `[agent] ${data.toString().trim()}`);
    });

    agent.stderr?.on('data', (data: Buffer) => {
      logger.warn({ workerId: id }, `[agent] ${data.toString().trim()}`);
    });

    agent.on('error', (err) => {
      logger.error({ err, workerId: id }, 'Worker agent process error');
      spawnedAgents.delete(id);
    });

    agent.on('exit', (code) => {
      logger.info({ workerId: id, code }, 'Worker agent process exited');
      spawnedAgents.delete(id);
      prisma.worker.update({ where: { id }, data: { status: 'offline' } }).catch(() => {});
    });

    spawnedAgents.set(id, agent);
    await prisma.worker.update({ where: { id }, data: { status: 'running' } });

    res.json({ message: `Worker agent "${worker.name}" starting locally on port ${port}`, launchType: 'local' });
  }
});

workerRoutes.post('/workers/:id/stop', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }

  if (worker.launchType === 'kubernetes') {
    const ns = worker.namespace || 'default';
    await k8sManager.init();
    await k8sManager.stopWorker(worker.name, ns);
    await prisma.worker.update({ where: { id }, data: { status: 'offline' } });
    res.json({ message: 'K8s worker pod deleted' });
  } else {
    // 1. Try stopping spawned process in memory
    const agent = spawnedAgents.get(id);
    if (agent && !agent.killed) {
      agent.kill('SIGTERM');
      setTimeout(() => { if (!agent.killed) agent.kill('SIGKILL'); }, 5000);
      spawnedAgents.delete(id);
    }

    // 2. Try sending HTTP /shutdown to the remote/local agent URL
    if (worker.url) {
      try {
        await fetch(`${worker.url}/shutdown`, { method: 'POST' });
      } catch { /* may already be dead or unreachable */ }
    }

    // 3. Try killing by port if local (only LISTEN sockets, never process.pid)
    if (worker.url && (worker.url.includes('localhost') || worker.url.includes('127.0.0.1'))) {
      const portMatch = worker.url.match(/:(\d+)/);
      if (portMatch) {
        const port = parseInt(portMatch[1], 10);
        try {
          const { execSync } = await import('child_process');
          const pids = execSync(`lsof -t -iTCP:${port} -sTCP:LISTEN 2>/dev/null || true`)
            .toString()
            .split('\n')
            .map(p => p.trim())
            .filter(p => p && Number(p) !== process.pid);
          if (pids.length > 0) {
            execSync(`kill -9 ${pids.join(' ')} 2>/dev/null || true`);
          }
        } catch { /* already dead */ }
      }
    }

    await prisma.worker.update({ where: { id }, data: { status: 'offline' } });
    res.json({ message: 'Local worker agent stopped successfully' });
  }
});

workerRoutes.get('/workers/:id/status', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const worker = await prisma.worker.findUnique({ where: { id } });
  if (!worker) { res.status(404).json({ message: 'Worker not found' }); return; }

  let running = false;
  let details: any = {};

  if (worker.launchType === 'kubernetes') {
    const ns = worker.namespace || 'default';
    await k8sManager.init();
    const phase = await k8sManager.getPodStatus(worker.name, ns);
    running = phase === 'Running';
    details = { podPhase: phase };
  } else {
    const agent = spawnedAgents.get(id);
    running = !!agent && !agent.killed;
    details = { pid: agent?.pid || null };
  }

  res.json({ running, launchType: worker.launchType, ...details });
});

workerRoutes.get('/workers/k8s-pods', async (req: Request, res: Response) => {
  const projectId = req.query.projectId as string;
  if (!projectId) { res.status(400).json({ message: 'projectId required' }); return; }

  const k8sCfg = await getProjectK8sConfig(projectId);
  if (!k8sCfg) { res.json({ pods: [] }); return; }

  await k8sManager.init(k8sCfg);
  const pods = await k8sManager.listWorkerPods(k8sCfg.namespace);
  res.json({ pods });
});

// ── Distribute a config across workers ────────────────────

workerRoutes.post('/projects/:pid/configs/:configId/distribute', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const configId = req.params.configId as string;

  const config = await prisma.testConfig.findUnique({
    where: { id: configId },
    include: { script: { select: { id: true, projectId: true, content: true, envVars: true } } },
  });
  if (!config) { res.status(404).json({ message: 'Config not found' }); return; }

  const onlineWorkers = await prisma.worker.findMany({
    where: { projectId: pid, status: 'online' },
  });
  if (onlineWorkers.length === 0) {
    res.status(400).json({ message: 'No online workers available' });
    return;
  }

  // Parse options
  let parsedOptions: Record<string, unknown> = {};
  try { parsedOptions = typeof config.options === 'string' ? JSON.parse(config.options) : config.options as any; } catch { parsedOptions = {}; }

  // Merge env vars (simplified — same as triggerRun but without output-type injection)
  const scriptEnvVars: Record<string, string> = safeJson(config.script.envVars);
  const configEnv: Record<string, string> = (parsedOptions.env as Record<string, string>) || {};
  const mergedEnv = { ...scriptEnvVars, ...configEnv };

  const defaultEnv = await prisma.environment.findFirst({
    where: { projectId: pid, isDefault: true },
  });
  if (defaultEnv) {
    const envVars: Record<string, string> = safeJson(defaultEnv.variables);
    if (defaultEnv.baseUrl) envVars.TARGET_URL = defaultEnv.baseUrl;
    Object.assign(mergedEnv, envVars);
  }

  parsedOptions.env = mergedEnv;

  let scriptContent = config.script.content;
  if (mergedEnv.TARGET_URL) {
    scriptContent = scriptContent.replace(/__TARGET_URL__/g, mergedEnv.TARGET_URL);
  }

  const userId = req.user?.userId || '00000000-0000-0000-0000-000000000000';

  // Create a single parent TestRun for the distributed run
  const run = await prisma.testRun.create({
    data: {
      testConfigId: config.id,
      scriptId: config.script.id,
      projectId: pid,
      userId,
      status: 'distributing',
      optionsSnapshot: JSON.stringify(parsedOptions),
    },
  });

  const totalVUs = (parsedOptions.vus as number) || 1;
  const vusPerWorker = Math.max(1, Math.floor(totalVUs / onlineWorkers.length));
  const csvFiles = await extractCsvFiles(scriptContent);

  // Create assignments and dispatch to each worker
  const dispatchResults: { workerId: string; workerName: string; workerUrl: string; vus: number; executionSegment?: string; loadPercentage?: number; accepted: boolean; error?: string }[] = [];

  logger.info(`[Distribution Engine] 🚀 Dispatching Run "${run.id}" across ${onlineWorkers.length} online worker nodes (Total VUs: ${totalVUs})`);

  for (let i = 0; i < onlineWorkers.length; i++) {
    const w = onlineWorkers[i];
    const workerVUs = i === onlineWorkers.length - 1
      ? totalVUs - vusPerWorker * (onlineWorkers.length - 1)
      : vusPerWorker;

    // Calculate k6 native execution segment: e.g., "0:0.3333", "0.3333:0.6667", "0.6667:1"
    const segStart = Number((i / onlineWorkers.length).toFixed(4));
    const segEnd = Number(((i + 1) / onlineWorkers.length).toFixed(4));
    const executionSegment = `${segStart}:${segEnd}`;
    const loadPercentage = Math.round((workerVUs / totalVUs) * 100);

    // Create assignment record
    await prisma.workerRunAssignment.create({
      data: {
        runId: run.id,
        workerId: w.id,
        vus: workerVUs,
        status: 'pending',
      },
    });

    // Prepare per-worker options (VU count plus native k6 execution segment)
    const workerOptions = {
      ...parsedOptions,
      vus: workerVUs,
      executionSegment,
    };

    // Dispatch HTTP call to worker agent
    try {
      const agentResp = await fetch(`${w.url}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          runId: run.id,
          scriptContent,
          options: workerOptions,
          csvFiles,
          authToken: extractToken(req),
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (agentResp.ok) {
        dispatchResults.push({ workerId: w.id, workerName: w.name, workerUrl: w.url, vus: workerVUs, executionSegment, loadPercentage, accepted: true });
        logger.info(`[Distribution Engine]  ├─ 🎯 Worker "${w.name}" (${w.url}) ACCEPTED -> ${workerVUs} VUs (k6 segment: ${executionSegment}, load: ${loadPercentage}%)`);
        // Mark assignment running
        await prisma.workerRunAssignment.updateMany({
          where: { runId: run.id, workerId: w.id },
          data: { status: 'running', startedAt: new Date() },
        });
      } else {
        const errBody = await agentResp.text().catch(() => 'unknown');
        dispatchResults.push({ workerId: w.id, workerName: w.name, workerUrl: w.url, vus: workerVUs, executionSegment, loadPercentage, accepted: false, error: errBody });
        logger.error(`[Distribution Engine]  ├─ ❌ Worker "${w.name}" (${w.url}) REJECTED -> ${errBody}`);
        await prisma.workerRunAssignment.updateMany({
          where: { runId: run.id, workerId: w.id },
          data: { status: 'failed', reason: errBody },
        });
      }
    } catch (err: any) {
      dispatchResults.push({ workerId: w.id, workerName: w.name, workerUrl: w.url, vus: workerVUs, executionSegment, loadPercentage, accepted: false, error: err.message });
      logger.error(`[Distribution Engine]  ├─ ❌ Worker "${w.name}" (${w.url}) CONNECTION ERROR -> ${err.message}`);
      await prisma.workerRunAssignment.updateMany({
        where: { runId: run.id, workerId: w.id },
        data: { status: 'failed', reason: err.message },
      });
    }
  }

  // Update run status if at least one worker accepted
  const anyAccepted = dispatchResults.some((d) => d.accepted);
  if (anyAccepted) {
    await prisma.testRun.update({ where: { id: run.id }, data: { status: 'running' } });
  } else {
    await prisma.testRun.update({ where: { id: run.id }, data: { status: 'failed', statusMessage: 'All workers rejected the dispatch' } });
  }

  const acceptedCount = dispatchResults.filter((d) => d.accepted).length;
  logger.info(`[Distribution Engine] ✅ Distributed Run "${run.id}" initiated across ${acceptedCount}/${onlineWorkers.length} workers!`);

  res.status(anyAccepted ? 201 : 500).json({
    run,
    dispatchResults,
  });
});

// ── Metrics ingestion from remote workers ────────────────

workerRoutes.post('/runs/:id/metrics', async (req: Request, res: Response) => {
  const runId = req.params.id as string;
  const point = req.body;

  if (point.type === 'Point') {
    await resultIngester.ingestPoint(runId, point);
    broadcastMetric(runId, point);
  }

  res.json({ accepted: true });
});

// ── Run completion from remote workers ───────────────────

workerRoutes.post('/runs/:id/complete', async (req: Request, res: Response) => {
  const runId = req.params.id as string;
  const { exitCode, requestLogs, cloudRunUrl, cloudRunId } = req.body;

  logger.info({ runId, exitCode, source: 'remote-agent' }, 'Remote agent reported run completion');

  try {
    await resultIngester.aggregateAndFinalize(runId, exitCode ?? null);
  } catch (err) {
    logger.error({ err, runId }, 'Failed to aggregate remote agent run');
  }

  // Persist request logs
  if (requestLogs && requestLogs.length > 0) {
    try {
      await prisma.testRequestLog.createMany({
        data: requestLogs.map((log: any) => ({
          testRunId: runId,
          method: log.method || 'UNKNOWN',
          url: log.url || '',
          status: typeof log.status === 'number' ? log.status : 0,
          body: log.body || null,
          headers: log.headers || null,
          timing: typeof log.timing === 'number' ? log.timing : null,
        })),
      });
    } catch (err) {
      logger.error({ err, runId }, 'Failed to persist request logs from remote agent');
    }
  }

  // Store cloud run info
  if (cloudRunUrl || cloudRunId) {
    await prisma.testRun.updateMany({
      where: { id: runId },
      data: { cloudRunId: cloudRunId ?? undefined, cloudRunUrl: cloudRunUrl ?? undefined },
    });
  }

  // Mark worker assignment as finished
  const assignStatus = exitCode === 0 ? 'completed' : exitCode === 104 ? 'completed' : 'failed';
  await prisma.workerRunAssignment.updateMany({
    where: { runId },
    data: { status: assignStatus, finishedAt: new Date() },
  });

  if (exitCode === 104) {
    logger.warn(`[Worker Completion] ⚠️ Worker reported performance SLA threshold breach (k6 exitCode=104) for Run "${runId}"`);
  } else if (exitCode !== 0) {
    logger.error(`[Worker Completion] ❌ Worker reported script execution error for Run "${runId}" (k6 exitCode=${exitCode})`);
  } else {
    logger.info(`[Worker Completion] ✅ Worker reported successful completion for Run "${runId}" (exitCode=0)`);
  }

  // Check if all assignments are done
  const remaining = await prisma.workerRunAssignment.count({
    where: { runId, status: { notIn: ['completed', 'failed'] } },
  });

  if (remaining === 0) {
    const finalRunStatus = exitCode === 0 ? 'completed' : exitCode === 104 ? 'completed' : 'failed';
    const statusMsg = exitCode === 104 ? 'Completed with breached performance thresholds (SLA missed)' : undefined;
    logger.info(`[Distribution Engine] 🏁 All worker assignments finished for Run "${runId}"! Final status: ${finalRunStatus}${statusMsg ? ` (${statusMsg})` : ''}`);
    await prisma.testRun.updateMany({
      where: { id: runId },
      data: { status: finalRunStatus, statusMessage: statusMsg, k6ExitCode: exitCode },
    });
  }

  res.json({ accepted: true });
});

// ── Assignment status update from remote workers ─────────

workerRoutes.post('/runs/:id/status', async (req: Request, res: Response) => {
  const runId = req.params.id as string;
  const { status } = req.body;

  if (status) {
    await prisma.workerRunAssignment.updateMany({
      where: { runId, status: 'pending' },
      data: { status, startedAt: status === 'running' ? new Date() : undefined },
    });

    await prisma.testRun.updateMany({
      where: { id: runId },
      data: { status },
    });
  }

  res.json({ accepted: true });
});

// ── Get assignments for a run ────────────────────────────

workerRoutes.get('/runs/:id/assignments', async (req: Request, res: Response) => {
  const runId = req.params.id as string;
  const assignments = await prisma.workerRunAssignment.findMany({
    where: { runId },
    include: { worker: { select: { name: true, url: true } } },
    orderBy: { createdAt: 'asc' },
  });
  const totalVUs = assignments.reduce((sum, a) => sum + a.vus, 0) || 1;
  const enriched = assignments.map((a, i) => {
    const segStart = Number((i / assignments.length).toFixed(4));
    const segEnd = Number(((i + 1) / assignments.length).toFixed(4));
    return {
      ...a,
      executionSegment: `${segStart}:${segEnd}`,
      loadPercentage: Math.round((a.vus / totalVUs) * 100),
    };
  });
  res.json(enriched);
});
