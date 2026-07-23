import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const alertRoutes = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  metricName: z.string().min(1),
  condition: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  threshold: z.number(),
  channelType: z.enum(['slack', 'webhook', 'email']),
  channelConfig: z.record(z.unknown()),
  enabled: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(0).optional(),
});

/**
 * @openapi
 * /projects/{pid}/alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: List alert rules for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of alert rules
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/AlertRule' }
 */
alertRoutes.get('/projects/:pid/alerts', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rules.map((r) => ({ ...r, channelConfig: safeJson(r.channelConfig) })));
});

/**
 * @openapi
 * /projects/{pid}/alerts:
 *   post:
 *     tags: [Alerts]
 *     summary: Create an alert rule
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
 *               description: { type: string }
 *               metricName: { type: string }
 *               condition: { type: string, enum: [gt, lt, gte, lte, eq] }
 *               threshold: { type: number }
 *               channelType: { type: string, enum: [slack, webhook, email] }
 *               channelConfig: { type: object }
 *               enabled: { type: boolean }
 *     responses:
 *       201:
 *         description: Alert rule created
 *       400:
 *         description: Invalid input
 */
alertRoutes.post('/projects/:pid/alerts', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  let body: z.infer<typeof createSchema>;
  try {
    body = createSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }
  const rule = await prisma.alertRule.create({
    data: {
      projectId,
      name: body.name,
      description: body.description ?? null,
      metricName: body.metricName,
      condition: body.condition,
      threshold: body.threshold,
      channelType: body.channelType,
      channelConfig: JSON.stringify(body.channelConfig),
      enabled: body.enabled ?? true,
      cooldownMinutes: body.cooldownMinutes ?? 0,
    },
  });
  logger.info({ ruleId: rule.id, projectId }, 'Alert rule created');
  res.status(201).json({ ...rule, channelConfig: safeJson(rule.channelConfig) });
});

/**
 * @openapi
 * /alerts/{id}:
 *   put:
 *     tags: [Alerts]
 *     summary: Update an alert rule
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
 *               description: { type: string }
 *               metricName: { type: string }
 *               condition: { type: string, enum: [gt, lt, gte, lte, eq] }
 *               threshold: { type: number }
 *               channelType: { type: string, enum: [slack, webhook, email] }
 *               channelConfig: { type: object }
 *               enabled: { type: boolean }
 *     responses:
 *       200:
 *         description: Alert rule updated
 */
alertRoutes.put('/alerts/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = createSchema.partial().parse(req.body);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.metricName !== undefined) data.metricName = body.metricName;
  if (body.condition !== undefined) data.condition = body.condition;
  if (body.threshold !== undefined) data.threshold = body.threshold;
  if (body.channelType !== undefined) data.channelType = body.channelType;
  if (body.channelConfig !== undefined) data.channelConfig = JSON.stringify(body.channelConfig);
  if (body.enabled !== undefined) data.enabled = body.enabled;
  if (body.cooldownMinutes !== undefined) data.cooldownMinutes = body.cooldownMinutes;
  const rule = await prisma.alertRule.update({ where: { id }, data });
  res.json({ ...rule, channelConfig: safeJson(rule.channelConfig) });
});

/**
 * @openapi
 * /alerts/{id}:
 *   delete:
 *     tags: [Alerts]
 *     summary: Delete an alert rule
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Alert rule deleted
 */
alertRoutes.delete('/alerts/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.alertRule.delete({ where: { id } });
  res.status(204).end();
});

/**
 * @openapi
 * /projects/{pid}/alerts/history:
 *   get:
 *     tags: [Alerts]
 *     summary: Get alert event history for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Alert event history
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/AlertEvent' }
 */
alertRoutes.get('/projects/:pid/alerts/history', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const rules = await prisma.alertRule.findMany({
    where: { projectId },
    select: { id: true },
  });
  const ruleIds = rules.map((r) => r.id);
  const events = await prisma.alertEvent.findMany({
    where: { alertRuleId: { in: ruleIds } },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { alertRule: { select: { name: true } } },
  });
  res.json(events);
});

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val ?? {};
}
