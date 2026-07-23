import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { dashboardRoutes } from '../dashboard.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', dashboardRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000000';

describe('Dashboard Routes', () => {
  let token: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app).post('/api/v1/auth/signup').send({ email: 'dash@test.com', name: 'Dash', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'dash@test.com', password: 'password123' })).body.token;

    const script = await prisma.script.create({
      data: { projectId: pid, name: 'dash-test', content: 'export default function() {}' },
    });

    for (let i = 0; i < 3; i++) {
      const run = await prisma.testRun.create({
        data: { projectId: pid, scriptId: script.id, userId, status: i === 0 ? 'failed' : 'completed' },
      });
      await prisma.testResult.create({
        data: { testRunId: run.id, metricName: 'http_req_duration', metricType: 'trend', avg: 100 + i * 10, p95: 150 + i * 10, p99: 180 + i * 10 },
      });
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('GET /projects/:pid/dashboard/summary', () => {
    it('returns dashboard summary', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/dashboard/summary`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('totalRuns', 3);
      expect(res.body).toHaveProperty('passedRuns', 2);
      expect(res.body).toHaveProperty('failedRuns', 1);
      expect(res.body.passRate).toBeCloseTo(66.67, 1);
      expect(res.body).toHaveProperty('avgDuration');
      expect(res.body.recentResults.length).toBe(3);
    });
  });

  describe('GET /projects/:pid/dashboard/trend', () => {
    it('returns trend data', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/dashboard/trend`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2); // only completed runs
      expect(res.body[0]).toHaveProperty('duration');
      expect(res.body[0]).toHaveProperty('p95');
      expect(res.body[0]).toHaveProperty('p99');
    });
  });
});