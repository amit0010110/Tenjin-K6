import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const dbConnectionRoutes = Router();

const createSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.enum(['postgres', 'mysql', 'sqlserver', 'sqlite']),
  host: z.string().optional().default('localhost'),
  port: z.coerce.number().int().optional().default(5432),
  database: z.string().optional().default(''),
  username: z.string().optional().default(''),
  password: z.string().optional().default(''),
  ssl: z.coerce.boolean().optional().default(false),
});

const updateSchema = createSchema.partial();

dbConnectionRoutes.get('/projects/:pid/db-connections', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const connections = await prisma.databaseConnection.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(connections);
});

dbConnectionRoutes.post('/projects/:pid/db-connections', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const connection = await prisma.databaseConnection.create({
    data: { projectId, ...parsed.data },
  });
  logger.info({ connectionId: connection.id, type: connection.type }, 'DB connection created');
  res.status(201).json(connection);
});

dbConnectionRoutes.get('/db-connections/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const connection = await prisma.databaseConnection.findUnique({ where: { id } });
  if (!connection) { res.status(404).json({ message: 'DB connection not found' }); return; }
  res.json(connection);
});

dbConnectionRoutes.put('/db-connections/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const existing = await prisma.databaseConnection.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'DB connection not found' }); return; }
  const connection = await prisma.databaseConnection.update({ where: { id }, data: parsed.data });
  res.json(connection);
});

dbConnectionRoutes.delete('/db-connections/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const existing = await prisma.databaseConnection.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'DB connection not found' }); return; }
  await prisma.databaseConnection.delete({ where: { id } });
  res.status(204).send();
});
