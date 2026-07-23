import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const auditRoutes = Router();

auditRoutes.get('/projects/:pid/audit-logs', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: { projectId: pid },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.auditLog.count({ where: { projectId: pid } }),
  ]);

  res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
});
