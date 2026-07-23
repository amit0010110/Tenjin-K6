import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { getChannel, QUEUE_RUN_TEST } from '../lib/rabbitmq.js';
import { extractCsvFiles } from './utils.js';

export const suiteRoutes = Router();

const createSuiteSchema = z.object({
  name: z.string().min(1).max(255),
  scriptIds: z.array(z.string()).min(1),
});

function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function extractUserId(req: Request): string {
  return (req as any).user?.userId || '00000000-0000-0000-0000-000000000000';
}

/**
 * @openapi
 * /projects/{pid}/suites:
 *   get:
 *     tags: [Suites]
 *     summary: List all test suites for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of suites
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/TestSuite' }
 */
suiteRoutes.get('/projects/:pid/suites', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const suites = await prisma.testSuite.findMany({
    where: { projectId: pid },
    include: {
      scripts: {
        orderBy: { order: 'asc' },
        include: { script: { select: { id: true, name: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json(suites);
});

/**
 * @openapi
 * /projects/{pid}/suites:
 *   post:
 *     tags: [Suites]
 *     summary: Create a test suite
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               scriptIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: Suite created
 *       400:
 *         description: Invalid input
 */
suiteRoutes.post('/projects/:pid/suites', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const parsed = createSuiteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }

  const { name, scriptIds } = parsed.data;

  const suite = await prisma.testSuite.create({
    data: {
      projectId: pid,
      name,
      scripts: {
        create: scriptIds.map((scriptId, idx) => ({ scriptId, order: idx })),
      },
    },
    include: {
      scripts: {
        orderBy: { order: 'asc' },
        include: { script: { select: { id: true, name: true } } },
      },
    },
  });

  res.status(201).json(suite);
});

/**
 * @openapi
 * /suites/{id}:
 *   get:
 *     tags: [Suites]
 *     summary: Get a single test suite with its scripts
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suite details
 *       404:
 *         description: Suite not found
 */
suiteRoutes.get('/suites/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const suite = await prisma.testSuite.findUnique({
    where: { id },
    include: {
      scripts: {
        orderBy: { order: 'asc' },
        include: { script: { select: { id: true, name: true, content: true } } },
      },
    },
  });
  if (!suite) { res.status(404).json({ message: 'Suite not found' }); return; }
  res.json(suite);
});

/**
 * @openapi
 * /suites/{id}:
 *   put:
 *     tags: [Suites]
 *     summary: Update a test suite (replace scripts)
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
 *               name: { type: string }
 *               scriptIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Suite updated
 *       400:
 *         description: Invalid input
 */
suiteRoutes.put('/suites/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = createSuiteSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }

  const { name, scriptIds } = parsed.data;

  const suite = await prisma.testSuite.update({
    where: { id },
    data: {
      name,
      scripts: {
        deleteMany: {},
        create: scriptIds.map((scriptId, idx) => ({ scriptId, order: idx })),
      },
    },
    include: {
      scripts: {
        orderBy: { order: 'asc' },
        include: { script: { select: { id: true, name: true } } },
      },
    },
  });

  res.json(suite);
});

/**
 * @openapi
 * /suites/{id}:
 *   delete:
 *     tags: [Suites]
 *     summary: Delete a test suite
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suite deleted
 */
suiteRoutes.delete('/suites/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.testSuiteScript.deleteMany({ where: { suiteId: id } });
  await prisma.testSuite.delete({ where: { id } });
  res.json({ message: 'Deleted' });
});

/**
 * @openapi
 * /suites/{id}/run:
 *   post:
 *     tags: [Suites]
 *     summary: Run a test suite (creates runs for each script)
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suite run started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 suiteRunId: { type: string, format: uuid }
 *                 runs: { type: array, items: { $ref: '#/components/schemas/TestRun' } }
 *       404:
 *         description: Suite not found
 */
suiteRoutes.post('/suites/:id/run', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const suite = await prisma.testSuite.findUnique({
    where: { id },
    include: {
      scripts: {
        orderBy: { order: 'asc' },
        include: { script: true },
      },
    },
  });
  if (!suite) { res.status(404).json({ message: 'Suite not found' }); return; }

  const userId = extractUserId(req);
  const suiteRunId = uuid();

  const runs = [];
  const channel = getChannel();

  for (const ss of suite.scripts) {
    const run = await prisma.testRun.create({
      data: {
        scriptId: ss.script.id,
        projectId: suite.projectId,
        userId,
        status: 'pending',
        suiteRunId,
        optionsSnapshot: JSON.stringify({}),
      },
    });
    runs.push(run);
  }

  // Enqueue the first run
  const first = runs[0];
  const scriptContent = suite.scripts[0].script.content;
  const csvFiles = await extractCsvFiles(scriptContent);
  await enqueueRun(channel, {
    runId: first.id,
    projectId: suite.projectId,
    scriptContent,
    options: {},
    csvFiles,
  });

  await prisma.testRun.update({
    where: { id: first.id },
    data: { status: 'running', startedAt: new Date() },
  });

  res.json({ suiteRunId, runs });
});

/**
 * @openapi
 * /suite-runs/{suiteRunId}:
 *   get:
 *     tags: [Suites]
 *     summary: Get all runs for a suite run
 *     parameters:
 *       - in: path
 *         name: suiteRunId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Suite run details with runs
 */
suiteRoutes.get('/suite-runs/:suiteRunId', async (req: Request, res: Response) => {
  const suiteRunId = req.params.suiteRunId as string;
  const runs = await prisma.testRun.findMany({
    where: { suiteRunId },
    orderBy: { createdAt: 'asc' },
    include: {
      script: { select: { name: true } },
      results: true,
      thresholdResults: true,
    },
  });
  if (runs.length === 0) { res.status(404).json({ message: 'Suite run not found' }); return; }
  res.json({ suiteRunId, runs, createdAt: runs[0].createdAt });
});

suiteRoutes.get('/suites/:id/runs', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const suiteScripts = await prisma.testSuiteScript.findMany({
    where: { suiteId: id },
    select: { scriptId: true },
  });
  const scriptIds = suiteScripts.map((ss) => ss.scriptId);
  if (scriptIds.length === 0) { res.json([]); return; }

  const distinct = await prisma.testRun.groupBy({
    by: ['suiteRunId'],
    where: {
      suiteRunId: { not: null },
      scriptId: { in: scriptIds },
    },
    _max: { createdAt: true },
    orderBy: { _max: { createdAt: 'desc' } },
  });
  const suiteRunIds = distinct.map((d) => d.suiteRunId).filter(Boolean) as string[];
  if (suiteRunIds.length === 0) { res.json([]); return; }

  const runs = await prisma.testRun.findMany({
    where: { suiteRunId: { in: suiteRunIds } },
    orderBy: { createdAt: 'desc' },
    include: { script: { select: { name: true } } },
  });
  res.json(runs);
});

async function enqueueRun(channel: any, payload: { runId: string; projectId?: string; scriptContent: string; options: Record<string, unknown>; prometheusPushUrl?: string; csvFiles?: any[] }) {
  channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify(payload)), { persistent: true });
}
