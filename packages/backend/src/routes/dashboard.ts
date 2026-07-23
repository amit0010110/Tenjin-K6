import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const dashboardRoutes = Router();

/**
 * @openapi
 * /projects/{pid}/dashboard/summary:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get dashboard summary stats for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Dashboard summary
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRuns: { type: integer }
 *                 passedRuns: { type: integer }
 *                 failedRuns: { type: integer }
 *                 passRate: { type: number }
 *                 avgDuration: { type: number }
 *                 recentResults:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       avg: { type: number, nullable: true }
 *                       createdAt: { type: string, format: date-time }
 */
dashboardRoutes.get('/projects/:pid/dashboard/summary', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : undefined;
  const since = hours ? new Date(Date.now() - hours * 3600_000) : undefined;

  const timeFilter = since ? { projectId, createdAt: { gte: since } } : { projectId };

  const totalRuns = await prisma.testRun.count({ where: timeFilter });
  const passedRuns = await prisma.testRun.count({
    where: { ...timeFilter, status: 'completed' },
  });

  const recentRuns = await prisma.testRun.findMany({
    where: timeFilter,
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: { results: { where: { metricName: 'http_req_duration' }, select: { avg: true } } },
  });

  const avgDuration = recentRuns.length
    ? recentRuns.reduce((sum, r) => sum + ((r.results[0]?.avg as number) ?? 0), 0) / recentRuns.length
    : 0;

  res.json({
    totalRuns,
    passedRuns,
    failedRuns: totalRuns - passedRuns,
    passRate: totalRuns > 0 ? (passedRuns / totalRuns) * 100 : 0,
    avgDuration,
    recentResults: recentRuns.map((r) => ({
      avg: r.results[0]?.avg ?? null,
      createdAt: r.createdAt,
    })),
  });
});

/**
 * @openapi
 * /projects/{pid}/dashboard/trend:
 *   get:
 *     tags: [Dashboard]
 *     summary: Get performance trend data for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Trend data points
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   createdAt: { type: string, format: date-time }
 *                   duration: { type: number, nullable: true }
 *                   p95: { type: number, nullable: true }
 *                   p99: { type: number, nullable: true }
 */
dashboardRoutes.get('/projects/:pid/dashboard/trend', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const hours = req.query.hours ? parseInt(req.query.hours as string, 10) : undefined;
  const since = hours ? new Date(Date.now() - hours * 3600_000) : undefined;

  const where: any = { projectId, status: 'completed' };
  if (since) where.createdAt = { gte: since };

  const runs = await prisma.testRun.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: hours ? 500 : 30,
    include: {
      results: {
        where: { metricName: 'http_req_duration' },
        select: { avg: true, p95: true, p99: true },
      },
    },
  });

  res.json(runs.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    duration: (r.results[0]?.avg as number) ?? null,
    p95: (r.results[0]?.p95 as number) ?? null,
    p99: (r.results[0]?.p99 as number) ?? null,
  })));
});
