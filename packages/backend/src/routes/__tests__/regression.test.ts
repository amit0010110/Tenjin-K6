import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { regressionRoutes } from '../regression.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', regressionRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000000';

describe('Regression Routes', () => {
  let token: string;
  let scriptId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'regr@test.com', name: 'Reg User', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'regr@test.com', password: 'password123' })).body.token;
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('returns message when fewer than 2 runs exist', async () => {
    const script = await prisma.script.create({
      data: { projectId: pid, name: 'regr-script', content: 'export default function() {}' },
    });
    scriptId = script.id;

    const res = await request(app)
      .post(`/api/v1/scripts/${script.id}/regression`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.summary.totalRuns).toBe(0);
    expect(res.body.message).toContain('Need at least 2');
  });

  it('returns regression analysis with 2+ runs', async () => {
    // Create 2 completed runs with result data
    for (let i = 0; i < 2; i++) {
      const run = await prisma.testRun.create({
        data: {
          projectId: pid, scriptId, userId,
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
          avg: 100 + i * 50,
          min: 50 + i * 20,
          max: 150 + i * 50,
          p95: 120 + i * 40,
        },
      });
    }

    const res = await request(app)
      .post(`/api/v1/scripts/${scriptId}/regression`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.regression.length).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.metricsCompared).toBeGreaterThanOrEqual(1);
  });
});