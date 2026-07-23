import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuid } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { evaluateThreshold } from '../lib/evaluateThreshold.js';
import { BudgetRule, BudgetCheckResult } from '@tenjint6/shared';

export const budgetRoutes = Router();

const budgetRuleSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(255),
  metric: z.string().min(1),
  expression: z.string().min(1),
  severity: z.enum(['error', 'warning']),
  enabled: z.boolean(),
});

const updateBudgetSchema = z.object({
  rules: z.array(budgetRuleSchema),
});

function extractUserId(req: Request): string {
  return (req as any).user?.userId || '00000000-0000-0000-0000-000000000000';
}

/**
 * @openapi
 * /projects/{pid}/budget:
 *   get:
 *     tags: [Budgets]
 *     summary: Get performance budget rules for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Budget rules
 *       404:
 *         description: Project not found
 */
budgetRoutes.get('/projects/:pid/budget', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const project = await prisma.project.findUnique({
    where: { id: pid },
    select: { budgetRules: true },
  });
  if (!project) { res.status(404).json({ message: 'Project not found' }); return; }

  const rules: BudgetRule[] = JSON.parse(project.budgetRules);
  res.json({ rules });
});

/**
 * @openapi
 * /projects/{pid}/budget:
 *   put:
 *     tags: [Budgets]
 *     summary: Update performance budget rules for a project
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
 *               rules:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/BudgetRule'
 *     responses:
 *       200:
 *         description: Budget rules updated
 *       400:
 *         description: Invalid input
 */
budgetRoutes.put('/projects/:pid/budget', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const parsed = updateBudgetSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
    return;
  }

  const project = await prisma.project.update({
    where: { id: pid },
    data: { budgetRules: JSON.stringify(parsed.data.rules) },
  });

  const rules: BudgetRule[] = JSON.parse(project.budgetRules);
  res.json({ rules });
});

/**
 * @openapi
 * /runs/{id}/budget-check:
 *   post:
 *     tags: [Budgets]
 *     summary: Evaluate performance budgets against a completed run
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Budget check results
 *       404:
 *         description: Run not found
 */
budgetRoutes.post('/runs/:id/budget-check', async (req: Request, res: Response) => {
  const runId = req.params.id as string;

  const run = await prisma.testRun.findUnique({
    where: { id: runId },
    include: {
      results: true,
      project: { select: { budgetRules: true } },
    },
  });
  if (!run) { res.status(404).json({ message: 'Run not found' }); return; }

  if (run.status !== 'completed' && run.status !== 'failed') {
    res.status(400).json({ message: `Run is ${run.status}, not finished yet` });
    return;
  }

  const budgetRules: BudgetRule[] = JSON.parse(run.project.budgetRules);
  const enabledRules = budgetRules.filter(r => r.enabled);

  if (enabledRules.length === 0) {
    const empty: BudgetCheckResult = {
      runId,
      rules: [],
      passed: true,
      timestamp: new Date().toISOString(),
    };
    res.json(empty);
    return;
  }

  const resultPoints = await prisma.testResultPoint.findMany({
    where: { testRunId: runId },
  });

  const groups = new Map<string, number[]>();
  for (const p of resultPoints) {
    const arr = groups.get(p.metricName) || [];
    arr.push(p.metricValue);
    groups.set(p.metricName, arr);
  }

  // Fall back to aggregated results if no raw points
  const aggregated = run.results.length > 0;
  const metricsMap = new Map<string, { avg: number; min: number; max: number; med: number; p90: number; p95: number; p99: number; count: number }>();
  for (const r of run.results) {
    metricsMap.set(r.metricName, {
      avg: r.avg ?? 0,
      min: r.min ?? 0,
      max: r.max ?? 0,
      med: r.med ?? 0,
      p90: r.p90 ?? 0,
      p95: r.p95 ?? 0,
      p99: r.p99 ?? 0,
      count: r.count ?? 0,
    });
  }

  const ruleResults: BudgetCheckResult['rules'] = [];
  let allPassed = true;

  for (const rule of enabledRules) {
    const rawValues = groups.get(rule.metric) || [];
    let actual: number | null = null;
    let passed = false;

    if (rawValues.length > 0) {
      const sorted = [...rawValues].sort((a, b) => a - b);
      const result = evaluateThreshold(rule.metric, rule.expression, sorted);
      actual = result.actual;
      passed = result.passed;
    } else if (aggregated) {
      const agg = metricsMap.get(rule.metric);
      if (agg) {
        const expr = rule.expression;
        const match = expr.match(/^(\w+(?:\(\d+(?:\.\d+)?\))?)\s*(<|>|<=|>=|==)\s*(\d+\.?\d*)$/);
        if (match) {
          const [, aggregator, operator, thresholdStr] = match;
          const threshold = parseFloat(thresholdStr);
          switch (aggregator) {
            case 'avg': actual = agg.avg; break;
            case 'min': actual = agg.min; break;
            case 'max': actual = agg.max; break;
            case 'med': actual = agg.med; break;
            case 'count': actual = agg.count; break;
            default: {
              const pMatch = aggregator.match(/^p\((\d+(?:\.\d+)?)\)$/);
              if (pMatch) {
                const p = parseFloat(pMatch[1]);
                actual = p === 90 ? agg.p90 : p === 95 ? agg.p95 : p === 99 ? agg.p99 : null;
              }
            }
          }
          if (actual !== null) {
            switch (operator) {
              case '<': passed = actual < threshold; break;
              case '>': passed = actual > threshold; break;
              case '<=': passed = actual <= threshold; break;
              case '>=': passed = actual >= threshold; break;
              case '==': passed = actual === threshold; break;
            }
          }
        }
      }
    } else {
      logger.warn({ runId, metric: rule.metric }, 'No data found for budget rule metric');
    }

    if (!passed) allPassed = false;

    ruleResults.push({
      ruleId: rule.id,
      name: rule.name,
      metric: rule.metric,
      expression: rule.expression,
      severity: rule.severity,
      passed,
      actual,
    });
  }

  // If any error-severity rule failed, the overall check fails
  const failedErrors = ruleResults.filter(r => !r.passed && r.severity === 'error');

  const result: BudgetCheckResult = {
    runId,
    rules: ruleResults,
    passed: failedErrors.length === 0,
    timestamp: new Date().toISOString(),
  };

  res.json(result);
});
