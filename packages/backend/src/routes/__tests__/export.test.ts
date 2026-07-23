import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { exportRoutes } from '../export.js';
import { budgetRoutes } from '../budget.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', exportRoutes);
  app.use('/api/v1', budgetRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000000';

describe('Export Routes', () => {
  let token: string;
  let runId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app).post('/api/v1/auth/signup').send({ email: 'expt@test.com', name: 'Export User', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'expt@test.com', password: 'password123' })).body.token;

    const script = await prisma.script.create({
      data: { projectId: pid, name: 'export-test', content: 'export default function() {}' },
    });
    const run = await prisma.testRun.create({
      data: { projectId: pid, scriptId: script.id, userId, status: 'completed', startedAt: new Date(), finishedAt: new Date() },
    });
    runId = run.id;

    await prisma.testResult.create({
      data: { testRunId: run.id, metricName: 'http_req_duration', metricType: 'trend', avg: 150, min: 50, max: 300, p95: 250, p99: 290, count: 100 },
    });
    await prisma.thresholdResult.create({
      data: { testRunId: run.id, metricName: 'http_req_duration', thresholdExpr: 'avg<200', passed: true, actualValue: 150 },
    });
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('exports run as JSON', async () => {
    const res = await request(app).get(`/api/v1/runs/${runId}/export/json`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.headers['content-disposition']).toContain('attachment');
    const body = JSON.parse(res.text);
    expect(body.id).toBe(runId);
    expect(body.metrics.length).toBe(1);
    expect(body.thresholds.length).toBe(1);
  });

  it('exports run as CSV', async () => {
    const res = await request(app).get(`/api/v1/runs/${runId}/export/csv`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('http_req_duration');
  });

  it('exports run as JUnit XML', async () => {
    const res = await request(app).get(`/api/v1/runs/${runId}/export/junit`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/xml');
    expect(res.text).toContain('<testsuite');
    expect(res.text).toContain('</testsuite>');
  });

  it('exports run as HTML report', async () => {
    const res = await request(app).get(`/api/v1/runs/${runId}/export/html`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Test Run Report');
  });

  it('exports run as PDF', async () => {
    const res = await request(app).get(`/api/v1/runs/${runId}/export/pdf`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.length).toBeGreaterThan(100);
  }, 30000);

  it('returns 404 for non-existent run', async () => {
    const res = await request(app).get('/api/v1/runs/00000000-0000-0000-0000-000000009999/export/json').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  // Budget tests
  it('gets empty budget rules for project', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/budget`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.rules).toEqual([]);
  });

  it('saves and retrieves budget rules', async () => {
    const rules = [{ id: 'test-1', name: 'P95 < 500ms', metric: 'http_req_duration', expression: 'p(95)<500', severity: 'error', enabled: true }];
    const saveRes = await request(app).put(`/api/v1/projects/${pid}/budget`).set('Authorization', `Bearer ${token}`).send({ rules });
    expect(saveRes.status).toBe(200);
    expect(saveRes.body.rules).toHaveLength(1);

    const getRes = await request(app).get(`/api/v1/projects/${pid}/budget`).set('Authorization', `Bearer ${token}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.rules).toHaveLength(1);
    expect(getRes.body.rules[0].name).toBe('P95 < 500ms');
  });

  it('budget-check passes for matching rule', async () => {
    // Set up a budget rule that the existing test run should pass
    const rules = [{ id: 'test-2', name: 'Avg < 1000', metric: 'http_req_duration', expression: 'avg<1000', severity: 'error', enabled: true }];
    await request(app).put(`/api/v1/projects/${pid}/budget`).set('Authorization', `Bearer ${token}`).send({ rules });

    const res = await request(app).post(`/api/v1/runs/${runId}/budget-check`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(true);
    expect(res.body.rules).toHaveLength(1);
    expect(res.body.rules[0].passed).toBe(true);
  });

  it('budget-check fails for unmet rule', async () => {
    const rules = [{ id: 'test-3', name: 'Avg < 1', metric: 'http_req_duration', expression: 'avg<1', severity: 'error', enabled: true }];
    await request(app).put(`/api/v1/projects/${pid}/budget`).set('Authorization', `Bearer ${token}`).send({ rules });

    const res = await request(app).post(`/api/v1/runs/${runId}/budget-check`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(false);
    expect(res.body.rules[0].passed).toBe(false);
  });

  it('budget-check rejects non-completed run', async () => {
    const pendingRun = await prisma.testRun.create({
      data: { projectId: pid, scriptId: (await prisma.script.findFirst({ where: { projectId: pid } }))!.id, userId, status: 'running' },
    });
    const res = await request(app).post(`/api/v1/runs/${pendingRun.id}/budget-check`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('running');
  });
});