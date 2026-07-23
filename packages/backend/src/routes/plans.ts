import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const planRoutes = Router();

const createPlanSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  blocks: z.string().optional(),
});

const updatePlanSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  blocks: z.string().optional(),
});

planRoutes.get('/projects/:pid/plans', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const plans = await prisma.testPlan.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { scripts: true } } },
  });
  res.json(plans);
});

planRoutes.post('/projects/:pid/plans', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const parsed = createPlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const plan = await prisma.testPlan.create({
    data: { projectId, name: parsed.data.name, description: parsed.data.description || null, blocks: parsed.data.blocks || '[]' },
  });
  logger.info({ planId: plan.id, projectId }, 'Test plan created');
  res.status(201).json(plan);
});

planRoutes.get('/plans/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const plan = await prisma.testPlan.findUnique({
    where: { id },
    include: { scripts: { select: { id: true, name: true, version: true } } },
  });
  if (!plan) { res.status(404).json({ message: 'Test plan not found' }); return; }
  res.json(plan);
});

planRoutes.put('/plans/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = updatePlanSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const existing = await prisma.testPlan.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Test plan not found' }); return; }
  const data: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.blocks !== undefined) data.blocks = parsed.data.blocks;
  const plan = await prisma.testPlan.update({ where: { id }, data });
  res.json(plan);
});

planRoutes.delete('/plans/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.testPlan.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ message: 'Test plan not found' }); return; }
    await prisma.testPlan.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    logger.error({ err, planId: id }, 'Failed to delete test plan');
    res.status(500).json({ message: 'Failed to delete test plan' });
  }
});
