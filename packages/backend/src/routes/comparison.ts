import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const comparisonRoutes = Router();

const compareSchema = z.object({
  runIds: z.array(z.string().uuid()).min(2).max(2),
});

/**
 * @openapi
 * /runs/compare:
 *   post:
 *     tags: [Comparison]
 *     summary: Compare two test runs
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               runIds:
 *                 type: array
 *                 items: { type: string, format: uuid }
 *                 minItems: 2
 *                 maxItems: 2
 *     responses:
 *       200:
 *         description: Comparison result with per-metric diff
 *       404:
 *         description: One or both runs not found
 */
comparisonRoutes.post('/runs/compare', async (req: Request, res: Response) => {
  let body: z.infer<typeof compareSchema>;
  try {
    body = compareSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }

  const runs = await prisma.testRun.findMany({
    where: { id: { in: body.runIds } },
    include: {
      script: { select: { name: true } },
      results: true,
    },
  });

  if (runs.length !== 2) {
    res.status(404).json({ message: 'One or both runs not found' });
    return;
  }

  const [a, b] = runs;

  const metricsMap = (results: { metricName: string; avg: number | null; min: number | null; max: number | null; med: number | null; p90: number | null; p95: number | null; p99: number | null; count: number | null }[]) => {
    const map = new Map<string, any>();
    for (const r of results) {
      if (!map.has(r.metricName)) {
        map.set(r.metricName, { name: r.metricName, avg: 0, min: 0, max: 0, med: 0, p90: 0, p95: 0, p99: 0, count: 0 });
      }
      const entry = map.get(r.metricName);
      entry.avg = r.avg ?? 0;
      entry.min = r.min ?? 0;
      entry.max = r.max ?? 0;
      entry.med = r.med ?? 0;
      entry.p90 = r.p90 ?? 0;
      entry.p95 = r.p95 ?? 0;
      entry.p99 = r.p99 ?? 0;
      entry.count = r.count ?? 0;
    }
    return Array.from(map.values());
  };

  const metricsA = metricsMap(a.results);
  const metricsB = metricsMap(b.results);

  const names = new Set<string>();
  for (const m of [...metricsA, ...metricsB]) {
    if (m?.name) names.add(m.name);
  }

  const diff = Array.from(names).map((name) => {
    const mA = metricsA.find((m: any) => m.name === name);
    const mB = metricsB.find((m: any) => m.name === name);
    return {
      name,
      runA: { value: mA?.avg ?? 0, p95: mA?.p95 ?? 0, p99: mA?.p99 ?? 0, count: mA?.count ?? 0 },
      runB: { value: mB?.avg ?? 0, p95: mB?.p95 ?? 0, p99: mB?.p99 ?? 0, count: mB?.count ?? 0 },
      changePercent: mA?.avg && mB?.avg ? ((mB.avg - mA.avg) / mA.avg * 100).toFixed(2) : null,
    };
  });

  logger.info({ runIds: body.runIds }, 'Run comparison computed');
  res.json({
    runs: [
      { id: a.id, name: a.script?.name, createdAt: a.createdAt },
      { id: b.id, name: b.script?.name, createdAt: b.createdAt },
    ],
    diff,
  });
});
