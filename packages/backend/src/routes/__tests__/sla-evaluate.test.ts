import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, seedTestData, cleanTestData } from '../../test/helpers.js';
import { evaluateSlaRules } from '../sla.js';

const pid = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000000';

async function createScript() {
  return prisma.script.create({
    data: {
      projectId: pid,
      name: 'sla-test-script',
      content: 'export default function() {}',
    },
  });
}

describe('evaluateSlaRules', () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('creates a breach when value exceeds threshold (gt)', async () => {
    const rule = await prisma.slaRule.create({
      data: {
        projectId: pid,
        name: 'P95 must be under 500ms',
        metric: 'http_req_duration',
        condition: 'lt',
        threshold: 500,
        timeWindow: 24,
      },
    });

    const script = await createScript();
    const run = await prisma.testRun.create({
      data: {
        projectId: pid,
        scriptId: script.id,
        userId,
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    await prisma.testResult.create({
      data: {
        testRunId: run.id,
        metricName: 'http_req_duration',
        metricType: 'trend',
        avg: 600,
      },
    });

    await evaluateSlaRules(run.id, pid);

    const breaches = await prisma.slaBreach.findMany({ where: { slaRuleId: rule.id } });
    expect(breaches.length).toBe(1);
    expect(breaches[0].actualValue).toBe(600);
    expect(breaches[0].threshold).toBe(500);
  });

  it('does NOT create a breach when value is within threshold (lt)', async () => {
    const rule = await prisma.slaRule.create({
      data: {
        projectId: pid,
        name: 'P95 under 200ms',
        metric: 'http_req_duration',
        condition: 'lt',
        threshold: 200,
        timeWindow: 24,
      },
    });

    const script = await createScript();
    const run = await prisma.testRun.create({
      data: {
        projectId: pid,
        scriptId: script.id,
        userId,
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    await prisma.testResult.create({
      data: {
        testRunId: run.id,
        metricName: 'http_req_duration',
        metricType: 'trend',
        avg: 150,
      },
    });

    await evaluateSlaRules(run.id, pid);

    const breaches = await prisma.slaBreach.findMany({ where: { slaRuleId: rule.id } });
    expect(breaches.length).toBe(0);
  });

  it('skips disabled rules', async () => {
    const rule = await prisma.slaRule.create({
      data: {
        projectId: pid,
        name: 'Disabled rule',
        metric: 'http_req_duration',
        condition: 'lt',
        threshold: 100,
        timeWindow: 24,
        enabled: false,
      },
    });

    const script = await createScript();
    const run = await prisma.testRun.create({
      data: {
        projectId: pid,
        scriptId: script.id,
        userId,
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    await prisma.testResult.create({
      data: {
        testRunId: run.id,
        metricName: 'http_req_duration',
        metricType: 'trend',
        avg: 999,
      },
    });

    await evaluateSlaRules(run.id, pid);

    const breaches = await prisma.slaBreach.findMany({ where: { slaRuleId: rule.id } });
    expect(breaches.length).toBe(0);
  });

  it('handles http_req_failed metric using rate field', async () => {
    const rule = await prisma.slaRule.create({
      data: {
        projectId: pid,
        name: 'Failure rate',
        metric: 'http_req_failed',
        condition: 'lt',
        threshold: 0.05,
        timeWindow: 24,
      },
    });

    const script = await createScript();
    const run = await prisma.testRun.create({
      data: {
        projectId: pid,
        scriptId: script.id,
        userId,
        status: 'completed',
        startedAt: new Date(),
        finishedAt: new Date(),
      },
    });

    await prisma.testResult.create({
      data: {
        testRunId: run.id,
        metricName: 'http_req_failed',
        metricType: 'rate',
        rate: 0.15,
        avg: 0.15,
      },
    });

    await evaluateSlaRules(run.id, pid);

    const breaches = await prisma.slaBreach.findMany({ where: { slaRuleId: rule.id } });
    expect(breaches.length).toBe(1);
    expect(breaches[0].actualValue).toBe(0.15);
  });

  it('handles non-existent run gracefully', async () => {
    await expect(evaluateSlaRules('non-existent-id', pid)).resolves.toBeUndefined();
  });
});