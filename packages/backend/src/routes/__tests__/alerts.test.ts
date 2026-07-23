import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { alertRoutes } from '../alerts.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', alertRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Alerts Routes', () => {
  let token: string;
  let ruleId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'alertuser@test.com', name: 'Alert User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'alertuser@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /projects/:pid/alerts', () => {
    it('creates an alert rule', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/alerts`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'High Latency Alert',
          metricName: 'http_req_duration',
          condition: 'gt',
          threshold: 1000,
          channelType: 'slack',
          channelConfig: { webhook: 'https://hooks.slack.com/test' },
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('High Latency Alert');
      expect(res.body.metricName).toBe('http_req_duration');
      expect(res.body.condition).toBe('gt');
      expect(res.body.threshold).toBe(1000);
      expect(res.body.channelType).toBe('slack');
      expect(res.body.enabled).toBe(true);
      expect(res.body.id).toBeTruthy();
      ruleId = res.body.id;
    });

    it('rejects invalid condition', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/alerts`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', metricName: 'http_req_duration', condition: 'invalid', threshold: 100, channelType: 'email', channelConfig: {} });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /projects/:pid/alerts', () => {
    it('lists alert rules', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/alerts`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].name).toBeTruthy();
    });
  });

  describe('PUT /alerts/:id', () => {
    it('updates an alert rule', async () => {
      const res = await request(app)
        .put(`/api/v1/alerts/${ruleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ threshold: 2000, enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.threshold).toBe(2000);
      expect(res.body.enabled).toBe(false);
    });
  });

  describe('GET /projects/:pid/alerts/history', () => {
    it('returns alert event history', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/alerts/history`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('DELETE /alerts/:id', () => {
    it('deletes an alert rule', async () => {
      const res = await request(app)
        .delete(`/api/v1/alerts/${ruleId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const list = await request(app)
        .get(`/api/v1/projects/${pid}/alerts`)
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.length).toBe(0);
    });
  });
});
