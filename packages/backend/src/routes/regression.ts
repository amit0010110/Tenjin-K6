import { Router, Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const regressionRoutes = Router();

interface MetricSummary {
  name: string;
  avg: number;
  min: number;
  max: number;
  p95: number;
  p99: number;
  count: number;
}

interface Baseline {
  runId: string;
  runLabel: string;
  metrics: MetricSummary[];
}

interface Current {
  runId: string;
  runLabel: string;
  metrics: MetricSummary[];
}

interface RegressionMetric {
  name: string;
  baseline: { avg: number; p95: number; p99: number; count: number };
  current: { avg: number; p95: number; p99: number; count: number };
  changePercent: number | null;
  direction: 'improved' | 'regressed' | 'unchanged';
  severity: 'high' | 'medium' | 'none';
}

regressionRoutes.post('/scripts/:id/regression', async (req: Request, res: Response) => {
  const scriptId = req.params.id as string;
  const { baselineRunId } = req.body as { baselineRunId?: string };

  // Fetch all completed runs for this script
  const runs = await prisma.testRun.findMany({
    where: { scriptId, status: 'completed' },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      results: {
        where: { metricName: { in: ['http_req_duration', 'http_req_failed', 'iterations', 'http_reqs', 'http_req_blocked', 'http_req_connecting', 'http_req_tls', 'http_req_sending', 'http_req_waiting', 'http_req_receiving'] } },
      },
      script: { select: { name: true } },
    },
  });

  if (runs.length < 2) {
    res.json({
      scriptId,
      scriptName: runs[0]?.script?.name || 'Unknown',
      regression: [],
      summary: { metricsCompared: 0, regressions: 0, improvements: 0, totalRuns: runs.length },
      message: 'Need at least 2 completed runs for regression analysis',
    });
    return;
  }

  const extractMetrics = (run: typeof runs[0]): MetricSummary[] =>
    run.results.map((r) => ({
      name: r.metricName,
      avg: r.avg ?? 0,
      min: r.min ?? 0,
      max: r.max ?? 0,
      p95: r.p95 ?? 0,
      p99: r.p99 ?? 0,
      count: r.count ?? 0,
    }));

  // Determine baseline: if baselineRunId provided, use that run; otherwise average of all runs except latest
  let baselineRuns: typeof runs;
  let baselineLabel: string;
  const latestRun = runs[0];
  const restRuns = runs.slice(1);

  if (baselineRunId) {
    const br = runs.find((r) => r.id === baselineRunId);
    if (!br) { res.status(404).json({ message: 'Baseline run not found' }); return; }
    baselineRuns = [br];
    baselineLabel = `Run ${br.id.slice(0, 8)} (${new Date(br.createdAt).toLocaleDateString()})`;
  } else if (restRuns.length >= 3) {
    // Use last 5 runs (or all remaining if fewer) as rolling average baseline
    baselineRuns = restRuns.slice(0, Math.min(5, restRuns.length));
    baselineLabel = `Rolling avg of last ${baselineRuns.length} runs`;
  } else if (restRuns.length > 0) {
    baselineRuns = restRuns;
    baselineLabel = `Single prior run`;
  } else {
    res.json({
      scriptId,
      scriptName: runs[0]?.script?.name || 'Unknown',
      regression: [],
      summary: { metricsCompared: 0, regressions: 0, improvements: 0, totalRuns: runs.length },
      message: 'Need a baseline run for comparison',
    });
    return;
  }

  // Aggregate baseline metrics (average across baseline runs)
  const baselineMetricsMap = new Map<string, number[]>();
  for (const br of baselineRuns) {
    for (const r of br.results) {
      if (!baselineMetricsMap.has(r.metricName)) baselineMetricsMap.set(r.metricName, []);
      baselineMetricsMap.get(r.metricName)!.push(r.avg ?? 0);
    }
  }
  const baselineMetrics: MetricSummary[] = Array.from(baselineMetricsMap.entries()).map(([name, values]) => ({
    name,
    avg: values.reduce((s, v) => s + v, 0) / values.length,
    min: Math.min(...values),
    max: Math.max(...values),
    p95: 0,
    p99: 0,
    count: values.length,
  }));

  const currentMetrics = extractMetrics(latestRun);

  const baseline: Baseline = {
    runId: baselineRuns[0].id,
    runLabel: baselineLabel,
    metrics: baselineMetrics,
  };

  const current: Current = {
    runId: latestRun.id,
    runLabel: `Run ${latestRun.id.slice(0, 8)} (${new Date(latestRun.createdAt).toLocaleDateString()})`,
    metrics: currentMetrics,
  };

  // Compute regression per metric
  const allNames = new Set<string>();
  for (const m of [...baselineMetrics, ...currentMetrics]) allNames.add(m.name);

  // Metrics where lower is better for regression detection
  const lowerIsBetter = new Set(['http_req_duration', 'http_req_blocked', 'http_req_connecting', 'http_req_tls', 'http_req_sending', 'http_req_waiting', 'http_req_receiving', 'http_req_failed']);
  // Metrics where higher is better
  const higherIsBetter = new Set(['http_reqs', 'iterations']);

  const regression: RegressionMetric[] = Array.from(allNames).map((name) => {
    const bm = baselineMetrics.find((m) => m.name === name);
    const cm = currentMetrics.find((m) => m.name === name);
    if (!bm || !cm) return null;

    const changePercent = bm.avg !== 0 ? ((cm.avg - bm.avg) / bm.avg) * 100 : null;

    let direction: 'improved' | 'regressed' | 'unchanged' = 'unchanged';
    let severity: 'high' | 'medium' | 'none' = 'none';

    if (changePercent !== null) {
      const absChange = Math.abs(changePercent);

      if (lowerIsBetter.has(name)) {
        // negative change = improved (lower latency), positive = regressed (higher latency)
        if (changePercent < -5) direction = 'improved';
        else if (changePercent > 5) direction = 'regressed';
        else direction = 'unchanged';
      } else if (higherIsBetter.has(name)) {
        // positive change = improved (more throughput), negative = regressed
        if (changePercent > 5) direction = 'improved';
        else if (changePercent < -5) direction = 'regressed';
        else direction = 'unchanged';
      } else {
        if (Math.abs(changePercent) > 10) direction = changePercent > 0 ? 'regressed' : 'improved';
      }

      if (direction === 'regressed') {
        severity = absChange > 20 ? 'high' : absChange > 10 ? 'medium' : 'none';
      }
    }

    return { name, baseline: { avg: bm.avg, p95: bm.p95, p99: bm.p99, count: bm.count }, current: { avg: cm.avg, p95: cm.p95, p99: cm.p99, count: cm.count }, changePercent: changePercent !== null ? parseFloat(changePercent.toFixed(2)) : null, direction, severity };
  }).filter(Boolean) as RegressionMetric[];

  const regressed = regression.filter((r) => r.direction === 'regressed');
  const improved = regression.filter((r) => r.direction === 'improved');

  logger.info({ scriptId, regressions: regressed.length, improvements: improved.length }, 'Regression analysis computed');

  res.json({
    scriptId,
    scriptName: runs[0]?.script?.name || 'Unknown',
    baseline,
    current,
    regression,
    summary: {
      metricsCompared: regression.length,
      regressions: regressed.length,
      improvements: improved.length,
      totalRuns: runs.length,
    },
  });
});
