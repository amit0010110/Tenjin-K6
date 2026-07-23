import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { sendNotification } from '../lib/notifier.js';
import { MetricPoint, AggregatedMetric, ThresholdRule, ThresholdResult } from '@tenjint6/shared';
import { evaluateThreshold, percentile } from '../lib/evaluateThreshold.js';

interface BufferedPoint {
  testRunId: string;
  timestamp: Date;
  metricName: string;
  metricValue: number;
  tags: string;
}

export class ResultIngester {
  private pointBuffer: BufferedPoint[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushPromise: Promise<void> | null = null;
  private readonly MAX_BUFFER = 50000;

  constructor() {
    this.flushTimer = setInterval(() => this.flush(), 2000);
  }

  async ingestPoint(runId: string, point: MetricPoint): Promise<void> {
    this.pointBuffer.push({
      testRunId: runId,
      timestamp: new Date(point.data.time),
      metricName: point.metric,
      metricValue: point.data.value,
      tags: JSON.stringify(point.data.tags ?? {}),
    });
    // Drop oldest points if buffer exceeds max to prevent OOM
    if (this.pointBuffer.length > this.MAX_BUFFER) {
      const excess = this.pointBuffer.length - this.MAX_BUFFER;
      this.pointBuffer.splice(0, excess);
    }
  }

  private async flush(): Promise<void> {
    if (this.pointBuffer.length === 0) return;
    if (this.flushPromise) return;

    const batch = this.pointBuffer.splice(0);
    this.flushPromise = prisma.testResultPoint.createMany({ data: batch })
      .then(() => { /* discard BatchPayload */ })
      .catch((err) => logger.error({ err, count: batch.length }, 'Failed to batch-ingest metric points'))
      .finally(() => { this.flushPromise = null; });
  }

  async flushNow(): Promise<void> {
    await this.flush();
    if (this.flushPromise) await this.flushPromise;
  }

  destroy(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  async aggregateAndFinalize(runId: string, exitCode: number | null, stderr?: string): Promise<{ status: string }> {
    await this.flushNow();
    const points = await prisma.testResultPoint.findMany({
      where: { testRunId: runId },
    });

    if (points.length === 0) {
      logger.warn({ runId, stderr }, 'No result points to aggregate');
      await this.updateRunStatus(runId, exitCode === 0 ? 'completed' : 'failed', exitCode, stderr);
      return { status: exitCode === 0 ? 'completed' : 'failed' };
    }

    // Group by metric name
    const groups = new Map<string, number[]>();
    for (const p of points) {
      const arr = groups.get(p.metricName) || [];
      arr.push(p.metricValue);
      groups.set(p.metricName, arr);
    }

    // Compute aggregations and batch-insert
    const testResultData: Array<{
      testRunId: string; metricName: string; metricType: string;
      avg: number; min: number; max: number; med: number;
      p90: number; p95: number; p99: number; count: number;
    }> = [];
    for (const [metricName, values] of groups) {
      const sorted = [...values].sort((a, b) => a - b);
      testResultData.push({
        testRunId: runId,
        metricName,
        metricType: 'trend',
        min: sorted[0],
        max: sorted[sorted.length - 1],
        avg: values.reduce((a, b) => a + b, 0) / values.length,
        med: percentile(sorted, 50),
        p90: percentile(sorted, 90),
        p95: percentile(sorted, 95),
        p99: percentile(sorted, 99),
        count: values.length,
      });
    }
    if (testResultData.length > 0) {
      await prisma.testResult.createMany({ data: testResultData });
    }

    // Evaluate thresholds if we have a config
    const run = await prisma.testRun.findUnique({
      where: { id: runId },
      include: { config: true },
    });

    if (run?.config?.options) {
      const configOptions = typeof run.config.options === 'string'
        ? JSON.parse(run.config.options)
        : run.config.options;
      const thresholds = (configOptions.thresholds ?? {}) as Record<string, string[]>;

      for (const [metricName, rules] of Object.entries(thresholds)) {
        const metric = groups.get(metricName);
        if (!metric) continue;

        const sorted = [...metric].sort((a, b) => a - b);
        const thresholdData: Array<{
          testRunId: string; metricName: string; thresholdExpr: string;
          passed: boolean; actualValue: number | null; aborted: boolean;
        }> = [];
        for (const expr of rules) {
          const result = this.evaluateThreshold(metricName, expr, sorted);
          thresholdData.push({
            testRunId: runId,
            metricName: result.metric,
            thresholdExpr: result.expression,
            passed: result.passed,
            actualValue: result.actual,
            aborted: result.aborted,
          });
        }
        if (thresholdData.length > 0) {
          await prisma.thresholdResult.createMany({ data: thresholdData });
        }
      }
    }

    const status = exitCode === 0 ? 'completed' : 'failed';
    await this.updateRunStatus(runId, status, exitCode, stderr);

    // Evaluate alert rules
    if (run) {
      await this.evaluateAlerts(run, groups);
    }

    // Evaluate SLA rules
    if (run) {
      const { evaluateSlaRules } = await import('../routes/sla.js');
      await evaluateSlaRules(run.id, run.projectId);
    }

    return { status };
  }

  private async evaluateAlerts(run: any, groups: Map<string, number[]>): Promise<void> {
    const rules = await prisma.alertRule.findMany({
      where: { projectId: run.projectId, enabled: true },
    });

    for (const rule of rules) {
      const values = groups.get(rule.metricName);
      if (!values) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const actual = this.computeMetric(rule.metricName, sorted);
      if (actual === null) continue;

      const triggered = this.compareValues(actual, rule.condition, rule.threshold);
      if (!triggered) continue;

      // Cooldown check — skip if triggered within cooldown window
      if (rule.cooldownMinutes > 0 && rule.lastTriggeredAt) {
        const cooldownEnd = new Date(rule.lastTriggeredAt.getTime() + rule.cooldownMinutes * 60_000);
        if (new Date() < cooldownEnd) {
          logger.debug({ ruleId: rule.id, remaining: Math.round((cooldownEnd.getTime() - Date.now()) / 1000) }, 'Alert in cooldown, skipping');
          continue;
        }
      }

      const channelConfig = typeof rule.channelConfig === 'string'
        ? JSON.parse(rule.channelConfig)
        : rule.channelConfig;

      const error = await sendNotification({
        ruleName: rule.name,
        channelType: rule.channelType,
        channelConfig,
        metricName: rule.metricName,
        metricValue: actual,
        condition: rule.condition,
        threshold: rule.threshold,
        projectId: run.projectId,
        runId: run.id,
      });

      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggeredAt: new Date() },
      });

      await prisma.alertEvent.create({
        data: {
          alertRuleId: rule.id,
          runId: run.id,
          metricName: rule.metricName,
          metricValue: actual,
          condition: rule.condition,
          threshold: rule.threshold,
          channelType: rule.channelType,
          sent: !error,
          error,
        },
      });

      logger.info({ ruleId: rule.id, runId: run.id, metric: rule.metricName, actual }, 'Alert triggered');
    }
  }

  private computeMetric(metricName: string, sorted: number[]): number | null {
    if (sorted.length === 0) return null;
    switch (metricName) {
      case 'http_req_duration': return sorted[sorted.length - 1]; // max — use p95 for alerts
      default: {
        const p95 = percentile(sorted, 95);
        return p95 ?? sorted[sorted.length - 1];
      }
    }
  }

  private compareValues(actual: number, condition: string, threshold: number): boolean {
    switch (condition) {
      case 'gt': return actual > threshold;
      case 'lt': return actual < threshold;
      case 'gte': return actual >= threshold;
      case 'lte': return actual <= threshold;
      case 'eq': return actual === threshold;
      default: return false;
    }
  }

  private async updateRunStatus(runId: string, status: string, exitCode: number | null, statusMessage?: string): Promise<void> {
    const activeAssignments = await prisma.workerRunAssignment.count({
      where: { runId, status: { notIn: ['completed', 'failed'] } },
    });
    if (activeAssignments > 1) {
      // Other workers in this distributed run are still executing, keep overall TestRun status running
      return;
    }
    await prisma.testRun.update({
      where: { id: runId },
      data: { status, k6ExitCode: exitCode, finishedAt: new Date(), ...(statusMessage && exitCode !== 0 ? { statusMessage: statusMessage.slice(0, 4000) } : {}) },
    });
  }

  private evaluateThreshold(
    metric: string,
    expr: string,
    sortedValues: number[],
  ): ThresholdResult {
    return evaluateThreshold(metric, expr, sortedValues);
  }
}
