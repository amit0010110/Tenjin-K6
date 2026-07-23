import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const environmentRoutes = Router();

const upsertSchema = z.object({
  name: z.string().min(1).max(255),
  baseUrl: z.string().url().optional().or(z.literal('')),
  variables: z.record(z.string()).optional(),
});

/**
 * @openapi
 * /projects/{pid}/environments:
 *   get:
 *     tags: [Environments]
 *     summary: List environments for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of environments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Environment' }
 */
environmentRoutes.get('/projects/:pid/environments', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const envs = await prisma.environment.findMany({
    where: { projectId },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
  });
  const parsed = envs.map((e) => ({
    ...e,
    variables: safeJson(e.variables),
  }));
  res.json(parsed);
});

/**
 * @openapi
 * /projects/{pid}/environments:
 *   post:
 *     tags: [Environments]
 *     summary: Create an environment for a project
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
 *               baseUrl: { type: string, format: uri }
 *               variables: { type: object, additionalProperties: { type: string } }
 *     responses:
 *       201:
 *         description: Environment created
 *       400:
 *         description: Invalid input
 */
environmentRoutes.post('/projects/:pid/environments', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }

  const existingCount = await prisma.environment.count({ where: { projectId } });
  const env = await prisma.environment.create({
    data: {
      projectId,
      name: body.name,
      baseUrl: body.baseUrl || null,
      variables: JSON.stringify(body.variables ?? {}),
      isDefault: existingCount === 0,
    },
  });

  logger.info({ envId: env.id, projectId }, 'Environment created');
  res.status(201).json({ ...env, variables: safeJson(env.variables) });
});

/**
 * @openapi
 * /environments/{id}:
 *   put:
 *     tags: [Environments]
 *     summary: Update an environment
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
 *               baseUrl: { type: string, format: uri }
 *               variables: { type: object, additionalProperties: { type: string } }
 *     responses:
 *       200:
 *         description: Environment updated
 */
environmentRoutes.put('/environments/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  let body: z.infer<typeof upsertSchema>;
  try {
    body = upsertSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }

  const env = await prisma.environment.update({
    where: { id },
    data: {
      name: body.name,
      baseUrl: body.baseUrl || null,
      variables: JSON.stringify(body.variables ?? {}),
    },
  });

  res.json({ ...env, variables: safeJson(env.variables) });
});

/**
 * @openapi
 * /environments/{id}:
 *   delete:
 *     tags: [Environments]
 *     summary: Delete an environment
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Environment deleted
 *       404:
 *         description: Environment not found
 */
environmentRoutes.delete('/environments/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) { res.status(404).json({ message: 'Environment not found' }); return; }

  await prisma.environment.delete({ where: { id } });

  if (env.isDefault) {
    const next = await prisma.environment.findFirst({
      where: { projectId: env.projectId },
      orderBy: { name: 'asc' },
    });
    if (next) {
      await prisma.environment.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  }

  res.status(204).end();
});

/**
 * @openapi
 * /environments/{id}/set-default:
 *   post:
 *     tags: [Environments]
 *     summary: Set an environment as the default for its project
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Default environment updated
 *       404:
 *         description: Environment not found
 */
environmentRoutes.post('/environments/:id/set-default', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const env = await prisma.environment.findUnique({ where: { id } });
  if (!env) { res.status(404).json({ message: 'Environment not found' }); return; }

  await prisma.environment.updateMany({
    where: { projectId: env.projectId, isDefault: true },
    data: { isDefault: false },
  });
  await prisma.environment.update({ where: { id }, data: { isDefault: true } });

  res.json({ message: 'Default environment updated' });
});

function safeJson(val: any): any {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val ?? {};
}
