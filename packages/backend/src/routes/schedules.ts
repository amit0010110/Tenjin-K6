import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getChannel, QUEUE_RUN_TEST } from '../lib/rabbitmq.js';
import { scheduler } from '../scheduler/index.js';

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val ?? {};
}

export const scheduleRoutes = Router();

const createScheduleSchema = z.object({
  name: z.string().min(1).max(255),
  configId: z.string().uuid(),
  cronExpression: z.string().min(1),
  enabled: z.boolean().optional(),
});

/**
 * @openapi
 * /projects/{pid}/schedules:
 *   get:
 *     tags: [Schedules]
 *     summary: List all schedules for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of schedules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Schedule' }
 */
scheduleRoutes.get('/projects/:pid/schedules', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const configs = await prisma.testConfig.findMany({
    where: { projectId },
    select: { id: true, name: true, scriptId: true },
  });
  const configIds = configs.map((c) => c.id);
  const schedules = await prisma.schedule.findMany({
    where: { testConfigId: { in: configIds } },
    include: { config: { select: { name: true, scriptId: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (schedules.length === 0) {
    res.json([]);
    return;
  }

  // Batch-load last runs for all schedule configs in a single query
  const configIdSet = [...new Set(schedules.map((s) => s.testConfigId))];
  const lastRuns = await prisma.testRun.groupBy({
    by: ['testConfigId'],
    where: { testConfigId: { in: configIdSet }, triggerType: 'schedule' },
    _max: { createdAt: true },
  });
  const lastRunIds = lastRuns.map((lr) => lr._max.createdAt).filter(Boolean) as Date[];
  const lastRunMap = new Map<string, any>();
  if (lastRunIds.length > 0) {
    const detailed = await prisma.testRun.findMany({
      where: { createdAt: { in: lastRunIds }, testConfigId: { in: configIdSet } },
      select: { id: true, testConfigId: true, status: true, createdAt: true, finishedAt: true },
    });
    for (const d of detailed) {
      if (d.testConfigId) lastRunMap.set(d.testConfigId, d);
    }
  }

  const schedulesWithRuns = schedules.map((s) => ({ ...s, lastRun: lastRunMap.get(s.testConfigId) ?? null }));
  res.json(schedulesWithRuns);
});

/**
 * @openapi
 * /configs/{id}/schedules:
 *   get:
 *     tags: [Schedules]
 *     summary: List schedules for a config
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of schedules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Schedule' }
 */
scheduleRoutes.get('/configs/:id/schedules', async (req: Request, res: Response) => {
  const testConfigId = req.params.id as string;
  const schedules = await prisma.schedule.findMany({
    where: { testConfigId },
  });
  res.json(schedules);
});

/**
 * @openapi
 * /projects/{pid}/schedules:
 *   post:
 *     tags: [Schedules]
 *     summary: Create a schedule for a project
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
 *               configId: { type: string, format: uuid }
 *               cronExpression: { type: string }
 *               enabled: { type: boolean }
 *     responses:
 *       201:
 *         description: Schedule created
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Config not found
 */
scheduleRoutes.post('/projects/:pid/schedules', async (req: Request, res: Response) => {
  const body = createScheduleSchema.parse(req.body);
  const config = await prisma.testConfig.findUnique({ where: { id: body.configId } });
  if (!config) { res.status(404).json({ message: 'Config not found' }); return; }
  const schedule = await prisma.schedule.create({
    data: {
      name: body.name,
      testConfigId: body.configId,
      cronExpr: body.cronExpression,
      enabled: body.enabled ?? true,
    },
  });
  scheduler.addSchedule(schedule);
  logger.info({ scheduleId: schedule.id }, 'Schedule created');
  res.status(201).json(schedule);
});

/**
 * @openapi
 * /configs/{id}/schedules:
 *   post:
 *     tags: [Schedules]
 *     summary: Create a schedule for a config (backward compatible)
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
 *               cronExpr: { type: string }
 *               enabled: { type: boolean }
 *     responses:
 *       201:
 *         description: Schedule created
 */
scheduleRoutes.post('/configs/:id/schedules', async (req: Request, res: Response) => {
  const testConfigId = req.params.id as string;
  const body = z.object({ cronExpr: z.string().min(1), enabled: z.boolean().optional() }).parse(req.body);
  const schedule = await prisma.schedule.create({
    data: {
      testConfigId,
      cronExpr: body.cronExpr,
      enabled: body.enabled ?? true,
    },
  });
  scheduler.addSchedule(schedule);
  res.status(201).json(schedule);
});

/**
 * @openapi
 * /schedules/{id}:
 *   patch:
 *     tags: [Schedules]
 *     summary: Enable or disable a schedule
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
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Schedule updated
 */
scheduleRoutes.patch('/schedules/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = z.object({ enabled: z.boolean() }).parse(req.body);
  const schedule = await prisma.schedule.update({
    where: { id },
    data: { enabled: body.enabled },
  });
  scheduler.updateSchedule(id, { enabled: schedule.enabled });
  res.json(schedule);
});

/**
 * @openapi
 * /schedules/{id}:
 *   put:
 *     tags: [Schedules]
 *     summary: Update a schedule (backward compatible)
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
 *               cronExpression: { type: string }
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Schedule updated
 */
scheduleRoutes.put('/schedules/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = createScheduleSchema.partial().parse(req.body);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.cronExpression !== undefined) data.cronExpr = body.cronExpression;
  if (body.enabled !== undefined) data.enabled = body.enabled;
  const schedule = await prisma.schedule.update({
    where: { id },
    data,
  });
  scheduler.updateSchedule(id, { enabled: schedule.enabled });
  res.json(schedule);
});

/**
 * @openapi
 * /schedules/{id}:
 *   delete:
 *     tags: [Schedules]
 *     summary: Delete a schedule
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Schedule deleted
 */
scheduleRoutes.delete('/schedules/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  scheduler.removeSchedule(id);
  await prisma.schedule.delete({ where: { id } });
  res.status(204).send();
});

/**
 * @openapi
 * /schedules/{id}/run:
 *   post:
 *     tags: [Schedules]
 *     summary: Run a schedule immediately triggering the linked config
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Run triggered
 *       400:
 *         description: Schedule has no linked config
 *       404:
 *         description: Schedule not found
 */
scheduleRoutes.post('/schedules/:id/run', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const schedule = await prisma.schedule.findUnique({
    where: { id },
    include: { config: { include: { script: { select: { content: true } } } } },
  });
  if (!schedule) { res.status(404).json({ message: 'Schedule not found' }); return; }
  if (!schedule.config) { res.status(400).json({ message: 'Schedule has no linked config' }); return; }

  const channel = getChannel();

  const run = await prisma.testRun.create({
    data: {
      testConfigId: schedule.config.id,
      scriptId: schedule.config.scriptId,
      projectId: schedule.config.projectId,
      userId: (req as any).user?.userId || '00000000-0000-0000-0000-000000000000',
      status: 'pending',
      triggerType: 'schedule',
    },
  });

  channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify({
    runId: run.id,
    scriptContent: (schedule.config as any).script?.content || '',
    options: safeJson((schedule.config as any).options || {}),
  })), { persistent: true });

  logger.info({ runId: run.id, scheduleId: id }, 'Schedule-triggered run');
  res.status(201).json(run);
});
