import { Router, Request, Response } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { getChannel, QUEUE_RUN_TEST } from '../lib/rabbitmq.js';

export const webhookRoutes = Router();
export const webhookTriggerRoutes = Router();

const createKeySchema = z.object({ name: z.string().min(1).max(255) });

/**
 * @openapi
 * /keys:
 *   post:
 *     tags: [Webhooks]
 *     summary: Create a new API key
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *     responses:
 *       201:
 *         description: API key created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id: { type: string, format: uuid }
 *                 name: { type: string }
 *                 key: { type: string }
 *                 createdAt: { type: string, format: date-time }
 *       401:
 *         description: Authentication required
 */
webhookRoutes.post('/keys', async (req: Request, res: Response) => {
  const body = createKeySchema.parse(req.body);
  const userId = (req as any).user?.userId;
  if (!userId) { res.status(401).json({ message: 'Authentication required' }); return; }
  const key = `gk6_${crypto.randomBytes(32).toString('hex')}`;
  const apiKey = await prisma.apiKey.create({
    data: { userId, name: body.name, key },
  });
  res.status(201).json({ id: apiKey.id, name: apiKey.name, key, createdAt: apiKey.createdAt });
});

/**
 * @openapi
 * /keys:
 *   get:
 *     tags: [Webhooks]
 *     summary: List all API keys for the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of API keys
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   name: { type: string }
 *                   key: { type: string }
 *                   lastUsedAt: { type: string, format: date-time, nullable: true }
 *                   createdAt: { type: string, format: date-time }
 *       401:
 *         description: Authentication required
 */
webhookRoutes.get('/keys', async (req: Request, res: Response) => {
  const userId = (req as any).user?.userId;
  if (!userId) { res.status(401).json({ message: 'Authentication required' }); return; }
  const keys = await prisma.apiKey.findMany({
    where: { userId },
    select: { id: true, name: true, key: true, lastUsedAt: true, createdAt: true },
  });
  res.json(keys);
});

/**
 * @openapi
 * /keys/{id}:
 *   delete:
 *     tags: [Webhooks]
 *     summary: Delete an API key
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: API key deleted
 *       401:
 *         description: Authentication required
 */
webhookRoutes.delete('/keys/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const userId = (req as any).user?.userId;
  if (!userId) { res.status(401).json({ message: 'Authentication required' }); return; }
  await prisma.apiKey.deleteMany({
    where: { id, userId },
  });
  res.status(204).end();
});

// CI/CD trigger endpoint — uses API key in Authorization header
const runTriggerSchema = z.object({
  configId: z.string().uuid(),
});

/**
 * @openapi
 * /trigger:
 *   post:
 *     tags: [Webhooks]
 *     summary: Trigger a test run via CI/CD webhook (API key auth)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               configId: { type: string, format: uuid }
 *     security: [{ apiKeyAuth: [] }]
 *     responses:
 *       201:
 *         description: Run triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 runId: { type: string, format: uuid }
 *                 status: { type: string }
 *       401:
 *         description: Missing or invalid API key
 *       404:
 *         description: Config not found
 */
webhookTriggerRoutes.post('/trigger', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    res.status(401).json({ message: 'Missing API key' });
    return;
  }

  const key = Array.isArray(authHeader) ? authHeader[0] : authHeader;
  const apiKey = await prisma.apiKey.findUnique({ where: { key } });
  if (!apiKey) {
    res.status(401).json({ message: 'Invalid API key' });
    return;
  }

  await prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } });

  const body = runTriggerSchema.parse(req.body);
  const config = await prisma.testConfig.findUnique({
    where: { id: body.configId },
    include: { script: { select: { id: true, content: true } } },
  });
  if (!config || !config.script) {
    res.status(404).json({ message: 'Config not found' });
    return;
  }

  const run = await prisma.testRun.create({
    data: {
      status: 'pending',
      scriptId: config.scriptId,
      projectId: config.projectId,
      userId: apiKey.userId,
      triggerType: 'api',
      optionsSnapshot: JSON.stringify(config.options || {}),
    },
  });

  const channel = getChannel();
  channel.sendToQueue(QUEUE_RUN_TEST, Buffer.from(JSON.stringify({
    runId: run.id,
    projectId: config.projectId,
    scriptContent: config.script.content,
    options: typeof config.options === 'string' ? JSON.parse(config.options) : config.options || {},
  })), { persistent: true });

  logger.info({ runId: run.id, configId: body.configId }, 'CI/CD run triggered');
  res.status(201).json({ runId: run.id, status: run.status });
});
