import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { comparisonRoutes } from '../comparison.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', comparisonRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000000';

describe('Comparison Routes', () => {
  let token: string;
  let runIds: string[];

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app).post('/api/v1/auth/signup').send({ email: 'comp@test.com', name: 'Comp User', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'comp@test.com', password: 'password123' })).body.token;

    const script = await prisma.script.create({
      data: { projectId: pid, name: 'comp-test', content: 'export default function() {}' },
    });

    runIds = [];
    for (let i = 0; i < 2; i++) {
      const run = await prisma.testRun.create({
        data: { projectId: pid, scriptId: script.id, userId, status: 'completed' },
      });
      runIds.push(run.id);
      await prisma.testResult.create({
        data: { testRunId: run.id, metricName: 'http_req_duration', metricType: 'trend', avg: 100 + i * 50 },
      });
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('compares two runs', async () => {
    const res = await request(app)
      .post('/api/v1/runs/compare')
      .set('Authorization', `Bearer ${token}`)
      .send({ runIds });
    expect(res.status).toBe(200);
    expect(res.body.runs.length).toBe(2);
    expect(res.body.diff.length).toBeGreaterThanOrEqual(1);
    expect(res.body.diff[0].changePercent).toBeTruthy();
  });

  it('returns 404 when one run is missing', async () => {
    const res = await request(app)
      .post('/api/v1/runs/compare')
      .set('Authorization', `Bearer ${token}`)
      .send({ runIds: [runIds[0], '00000000-0000-0000-0000-000000009999'] });
    expect(res.status).toBe(404);
  });

  it('rejects invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/runs/compare')
      .set('Authorization', `Bearer ${token}`)
      .send({ runIds: ['not-a-uuid'] });
    expect(res.status).toBe(400);
  });
});