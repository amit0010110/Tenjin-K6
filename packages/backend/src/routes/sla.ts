import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const slaRoutes = Router();

function pidParam(req: Request): string {
  return req.params.pid as string;
}

function idParam(req: Request): string {
  return req.params.id as string;
}

const createRuleSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  scriptId: z.string().uuid().nullable().optional(),
  metric: z.enum(['http_req_duration', 'http_req_failed', 'http_reqs', 'iterations']),
  condition: z.enum(['lt', 'gt', 'lte', 'gte']),
  threshold: z.number(),
  timeWindow: z.number().int().min(1).max(8760).default(24),
  enabled: z.boolean().default(true),
});

const updateRuleSchema = createRuleSchema.partial();

// List SLA rules for a project
slaRoutes.get('/projects/:pid/sla/rules', async (req: Request, res: Response) => {
  const projectId = pidParam(req);
  const rules = await prisma.slaRule.findMany({
    where: { projectId },
    include: { script: { select: { id: true, name: true } }, _count: { select: { breaches: true } } },
    orderBy: { createdAt: 'desc' },
  });
  res.json(rules);
});

// Create SLA rule
slaRoutes.post('/projects/:pid/sla/rules', async (req: Request, res: Response) => {
  const projectId = pidParam(req);
  let body: z.infer<typeof createRuleSchema>;
  try {
    body = createRuleSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }
  const rule = await prisma.slaRule.create({
    data: {
      projectId,
      name: body.name,
      description: body.description,
      scriptId: body.scriptId ?? null,
      metric: body.metric,
      condition: body.condition,
      threshold: body.threshold,
      timeWindow: body.timeWindow,
      enabled: body.enabled,
    },
    include: { script: { select: { id: true, name: true } } },
  });
  logger.info({ ruleId: rule.id, projectId }, 'SLA rule created');
  res.status(201).json(rule);
});

// Update SLA rule
slaRoutes.put('/sla/rules/:id', async (req: Request, res: Response) => {
  const id = idParam(req);
  const body = updateRuleSchema.parse(req.body);
  const rule = await prisma.slaRule.update({
    where: { id },
    data: { ...body, scriptId: body.scriptId !== undefined ? (body.scriptId ?? null) : undefined },
    include: { script: { select: { id: true, name: true } } },
  });
  logger.info({ ruleId: id }, 'SLA rule updated');
  res.json(rule);
});

// Toggle SLA rule enabled/disabled
slaRoutes.patch('/sla/rules/:id/toggle', async (req: Request, res: Response) => {
  const id = idParam(req);
  const existing = await prisma.slaRule.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'SLA rule not found' }); return; }
  const rule = await prisma.slaRule.update({
    where: { id },
    data: { enabled: !existing.enabled },
  });
  res.json(rule);
});

// Delete SLA rule
slaRoutes.delete('/sla/rules/:id', async (req: Request, res: Response) => {
  await prisma.slaRule.delete({ where: { id: idParam(req) } });
  res.status(204).end();
});

// Get compliance status for all enabled rules
slaRoutes.get('/projects/:pid/sla/status', async (req: Request, res: Response) => {
  const projectId = pidParam(req);
  const rules = await prisma.slaRule.findMany({
    where: { projectId, enabled: true },
    include: { script: { select: { id: true, name: true } } },
  });

  if (rules.length === 0) {
    res.json({ statuses: [], evaluatedAt: new Date().toISOString() });
    return;
  }

  const since = new Date(Date.now() - Math.max(...rules.map((r) => r.timeWindow)) * 3600_000);

  // Single batch query for all runs with results
  const allRuns = await prisma.testRun.findMany({
    where: {
      projectId,
      status: 'completed',
      finishedAt: { gte: since },
    },
    include: { results: true },
    orderBy: { finishedAt: 'desc' },
  });

  // Get recent breaches for all rules in one query
  const ruleIds = rules.map((r) => r.id);
  const recentBreaches = await prisma.slaBreach.findMany({
    where: { slaRuleId: { in: ruleIds } },
    orderBy: { breachedAt: 'desc' },
    distinct: ['slaRuleId'],
  });
  const breachMap = new Map(recentBreaches.map((b) => [b.slaRuleId, b.breachedAt]));

  const statuses = rules.map((rule) => {
    const windowStart = new Date(Date.now() - rule.timeWindow * 3600_000);
    const runs = allRuns.filter((r) => r.finishedAt && r.finishedAt >= windowStart && (!rule.scriptId || r.scriptId === rule.scriptId));

    if (runs.length === 0) {
      return { ruleId: rule.id, name: rule.name, metric: rule.metric, condition: rule.condition, threshold: rule.threshold, compliant: true, runsAnalyzed: 0, actualValue: null, message: 'No runs in time window' };
    }

    const values = runs.map((r) => {
      const result = r.results.find((res) => res.metricName === rule.metric);
      if (!result) return null;
      if (rule.metric === 'http_req_failed') return result.rate ?? result.avg ?? 0;
      return result.avg ?? 0;
    }).filter((v): v is number => v !== null);

    if (values.length === 0) {
      return { ruleId: rule.id, name: rule.name, metric: rule.metric, condition: rule.condition, threshold: rule.threshold, compliant: true, runsAnalyzed: runs.length, actualValue: null, message: 'No metric data available' };
    }

    const actualValue = values.reduce((s, v) => s + v, 0) / values.length;
    const compliant = compareValues(actualValue, rule.condition, rule.threshold);

    return {
      ruleId: rule.id,
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      compliant,
      runsAnalyzed: runs.length,
      actualValue: parseFloat(actualValue.toFixed(4)),
      lastBreachAt: breachMap.get(rule.id) ?? null,
    };
  });

  res.json({ statuses, evaluatedAt: new Date().toISOString() });
});

// List breaches
slaRoutes.get('/projects/:pid/sla/breaches', async (req: Request, res: Response) => {
  const pId = pidParam(req);
  const ruleId = typeof req.query.ruleId === 'string' ? req.query.ruleId : undefined;
  const breaches = await prisma.slaBreach.findMany({
    where: {
      slaRule: { projectId: pId },
      ...(ruleId ? { slaRuleId: ruleId } : {}),
    },
    include: {
      slaRule: { select: { id: true, name: true, metric: true, threshold: true, condition: true } },
      run: { select: { id: true, status: true, createdAt: true } },
    },
    orderBy: { breachedAt: 'desc' },
    take: 100,
  });
  res.json(breaches);
});

// Get breaches for a specific rule
slaRoutes.get('/sla/rules/:id/breaches', async (req: Request, res: Response) => {
  const id = idParam(req);
  const breaches = await prisma.slaBreach.findMany({
    where: { slaRuleId: id },
    include: { run: { select: { id: true, status: true, createdAt: true } } },
    orderBy: { breachedAt: 'desc' },
    take: 100,
  });
  res.json(breaches);
});

// Generate SLA compliance report
slaRoutes.get('/projects/:pid/sla/report', async (req: Request, res: Response) => {
  const projectId = pidParam(req);
  const rules = await prisma.slaRule.findMany({
    where: { projectId },
    include: { script: { select: { id: true, name: true } }, _count: { select: { breaches: true } } },
    orderBy: { createdAt: 'desc' },
  });

  if (rules.length === 0) {
    res.json({
      projectId, generatedAt: new Date().toISOString(), reportWindow: '168h',
      overallCompliance: 100, totalRules: 0, enabledRules: 0, totalBreaches: 0, rules: [],
    });
    return;
  }

  const totalTimeWindow = 168; // 7 days default for report
  const since = new Date(Date.now() - totalTimeWindow * 3600_000);

  // Single batch query for all runs with results
  const allRuns = await prisma.testRun.findMany({
    where: {
      projectId,
      status: 'completed',
      finishedAt: { gte: since },
    },
    include: { results: true },
    orderBy: { finishedAt: 'desc' },
  });

  const reportData = rules.map((rule) => {
    const runs = allRuns.filter((r) => r.finishedAt && r.finishedAt >= since && (!rule.scriptId || r.scriptId === rule.scriptId));

    const values = runs.map((r) => {
      const result = r.results.find((res) => res.metricName === rule.metric);
      if (!result) return null;
      if (rule.metric === 'http_req_failed') return result.rate ?? result.avg ?? 0;
      return result.avg ?? 0;
    }).filter((v): v is number => v !== null);

    const totalRuns = runs.length;
    const compliantRuns = values.filter((v) => compareValues(v, rule.condition, rule.threshold)).length;
    const compliancePercent = totalRuns > 0 ? (compliantRuns / totalRuns) * 100 : 100;

    return {
      ruleId: rule.id,
      name: rule.name,
      metric: rule.metric,
      condition: rule.condition,
      threshold: rule.threshold,
      timeWindow: rule.timeWindow,
      scriptName: rule.script?.name ?? null,
      totalRuns,
      compliantRuns,
      breachedRuns: totalRuns - compliantRuns,
      compliancePercent: parseFloat(compliancePercent.toFixed(2)),
      totalBreaches: rule._count.breaches,
      enabled: rule.enabled,
    };
  });

  const overallCompliance = reportData.length > 0
    ? reportData.reduce((s, r) => s + r.compliancePercent, 0) / reportData.length
    : 100;

  res.json({
    projectId,
    generatedAt: new Date().toISOString(),
    reportWindow: `${totalTimeWindow}h`,
    overallCompliance: parseFloat(overallCompliance.toFixed(2)),
    totalRules: rules.length,
    enabledRules: rules.filter((r) => r.enabled).length,
    totalBreaches: rules.reduce((s, r) => s + r._count.breaches, 0),
    rules: reportData,
  });
});

// Auto-evaluate SLA rules after run completion
export async function evaluateSlaRules(runId: string, projectId: string): Promise<void> {
  try {
    const rules = await prisma.slaRule.findMany({
      where: { projectId, enabled: true },
    });

    if (rules.length === 0) return;

    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: { results: true },
    });

    if (!run) return;

    for (const rule of rules) {
      const result = run.results.find((r) => r.metricName === rule.metric);
      if (!result) continue;

      const actualValue = rule.metric === 'http_req_failed'
        ? (result.rate ?? result.avg ?? 0)
        : (result.avg ?? 0);

      const breached = !compareValues(actualValue, rule.condition, rule.threshold);

      if (breached) {
        await prisma.slaBreach.create({
          data: {
            slaRuleId: rule.id,
            runId: run.id,
            metric: rule.metric,
            actualValue,
            threshold: rule.threshold,
            message: `${rule.metric} = ${actualValue.toFixed(2)} ${conditionLabel(rule.condition)} ${rule.threshold}`,
          },
        });
        logger.warn({ ruleId: rule.id, runId, metric: rule.metric, actual: actualValue, threshold: rule.threshold }, 'SLA breach detected');
      }
    }
  } catch (err) {
    logger.error({ err, runId }, 'Failed to evaluate SLA rules');
  }
}

function compareValues(actual: number, condition: string, threshold: number): boolean {
  switch (condition) {
    case 'gt': return actual > threshold;
    case 'lt': return actual < threshold;
    case 'gte': return actual >= threshold;
    case 'lte': return actual <= threshold;
    default: return false;
  }
}

function conditionLabel(condition: string): string {
  switch (condition) {
    case 'gt': return '>';
    case 'lt': return '<';
    case 'gte': return '>=';
    case 'lte': return '<=';
    default: return condition;
  }
}
