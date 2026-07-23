import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const dashboardsRoutes = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  widgets: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  widgets: z.string().optional(),
});

dashboardsRoutes.get('/projects/:pid/dashboards', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const dashboards = await prisma.dashboard.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(dashboards);
});

dashboardsRoutes.post('/projects/:pid/dashboards', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const body = createSchema.parse(req.body);

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { res.status(404).json({ message: 'Project not found' }); return; }

  const dashboard = await prisma.dashboard.create({
    data: {
      projectId,
      name: body.name,
      widgets: body.widgets || '[]',
    },
  });

  logger.info({ dashboardId: dashboard.id, projectId }, 'Dashboard created');
  res.status(201).json(dashboard);
});

dashboardsRoutes.get('/dashboards/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const dashboard = await prisma.dashboard.findUnique({ where: { id } });
  if (!dashboard) { res.status(404).json({ message: 'Dashboard not found' }); return; }
  res.json(dashboard);
});

dashboardsRoutes.put('/dashboards/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = updateSchema.parse(req.body);

  const existing = await prisma.dashboard.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Dashboard not found' }); return; }

  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.widgets !== undefined) data.widgets = body.widgets;

  const dashboard = await prisma.dashboard.update({ where: { id }, data });
  res.json(dashboard);
});

dashboardsRoutes.delete('/dashboards/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.dashboard.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Dashboard not found' }); return; }

  await prisma.dashboard.delete({ where: { id } });
  res.status(204).send();
});
