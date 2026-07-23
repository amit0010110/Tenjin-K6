import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const retentionRoutes = Router();

/**
 * @openapi
 * /projects/{pid}/retention:
 *   get:
 *     tags: [Retention]
 *     summary: Get data retention stats for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Retention statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 totalRuns: { type: integer }
 *                 totalPoints: { type: integer }
 *                 oldestRunAt: { type: string, format: date-time, nullable: true }
 *                 latestRunAt: { type: string, format: date-time, nullable: true }
 */
retentionRoutes.get('/projects/:pid/retention', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;

  const totalRuns = await prisma.testRun.count({ where: { projectId: pid } });
  const totalPoints = await prisma.testResultPoint.count({
    where: { testRun: { projectId: pid } },
  });
  const oldestRun = await prisma.testRun.findFirst({
    where: { projectId: pid },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const largestRun = await prisma.testRun.findFirst({
    where: { projectId: pid },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });

  res.json({
    totalRuns,
    totalPoints,
    oldestRunAt: oldestRun?.createdAt ?? null,
    latestRunAt: largestRun?.createdAt ?? null,
  });
});

/**
 * @openapi
 * /projects/{pid}/purge:
 *   post:
 *     tags: [Retention]
 *     summary: Purge old test runs for a project
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
 *               olderThanDays: { type: integer, default: 90 }
 *     responses:
 *       200:
 *         description: Purge result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletedRuns: { type: integer }
 *                 message: { type: string }
 */
retentionRoutes.post('/projects/:pid/purge', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const olderThanDays = Math.max(1, parseInt(req.body.olderThanDays as string) || 90);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const oldRuns = await prisma.testRun.findMany({
    where: { projectId: pid, createdAt: { lt: cutoff } },
    select: { id: true },
  });

  const runIds = oldRuns.map((r) => r.id);
  const deletedRuns = runIds.length;

  if (deletedRuns === 0) {
    res.json({ deletedRuns: 0, message: 'No runs to purge' });
    return;
  }

  // Cascade deletes handle the related records automatically
  await prisma.testRun.deleteMany({
    where: { id: { in: runIds } },
  });

  logger.info({ projectId: pid, deletedRuns, olderThanDays }, 'Purged old runs');

  res.json({ deletedRuns, message: `Deleted ${deletedRuns} runs older than ${olderThanDays} days` });
});
