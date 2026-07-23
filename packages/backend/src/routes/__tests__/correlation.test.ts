import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { correlationRoutes } from '../correlation.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', correlationRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';
const userId = '00000000-0000-0000-0000-000000000000';

describe('Correlation Routes', () => {
  let token: string;
  let scriptId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app).post('/api/v1/auth/signup').send({ email: 'corr@test.com', name: 'Corr', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'corr@test.com', password: 'password123' })).body.token;

    const script = await prisma.script.create({
      data: { projectId: pid, name: 'corr-test', content: 'export default function() { const res = http.get("https://test.com"); const token = res.json().token; }' },
    });
    scriptId = script.id;
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /scripts/auto-correlate', () => {
    it('suggests correlation points', async () => {
      const res = await request(app)
        .post('/api/v1/scripts/auto-correlate')
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'const res = http.get("https://api.example.com");\nconst data = \'{"token": "abc123"}\';\nconst parsed = JSON.parse(data);\nconst t = parsed.token;' });
      expect(res.status).toBe(200);
      expect(res.body.suggestions.length).toBeGreaterThanOrEqual(1);
      expect(res.body.suggestions[0]).toHaveProperty('variable');
    });

    it('returns 400 for empty content', async () => {
      const res = await request(app)
        .post('/api/v1/scripts/auto-correlate')
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('GET /scripts/:id/anomalies', () => {
    it('returns message when fewer than 3 runs', async () => {
      const res = await request(app)
        .get(`/api/v1/scripts/${scriptId}/anomalies`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Need at least 3');
    });

    it('detects anomalies with enough runs', async () => {
      for (let i = 0; i < 5; i++) {
        const run = await prisma.testRun.create({
          data: { projectId: pid, scriptId, userId, status: 'completed' },
        });
        await prisma.testResult.create({
          data: { testRunId: run.id, metricName: 'http_req_duration', metricType: 'trend', avg: 100 + i * 10 },
        });
      }

      const res = await request(app)
        .get(`/api/v1/scripts/${scriptId}/anomalies`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('anomalies');
      expect(res.body).toHaveProperty('totalRuns');
      expect(res.body.totalRuns).toBe(5);
    });
  });
});