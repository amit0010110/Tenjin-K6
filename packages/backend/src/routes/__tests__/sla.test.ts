import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, initTestDb, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { slaRoutes } from '../sla.js';
import { authRoutes } from '../auth.js';
import { scriptRoutes } from '../scripts.js';
import { configRoutes } from '../configs.js';
import { runRoutes } from '../runs.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', scriptRoutes);
  app.use('/api/v1', configRoutes);
  app.use('/api/v1', runRoutes);
  app.use('/api/v1', slaRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('SLA Routes', () => {
  let token: string;
  let ruleId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    // Create a user with a real password hash so login works
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'slauser@test.com', name: 'SLA User', password: 'password123' });
    // Fallback: try login even if signup fails (e.g. user exists from parallel test)
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'slauser@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /projects/:pid/sla/rules', () => {
    it('creates an SLA rule', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/sla/rules`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'P95 Latency',
          metric: 'http_req_duration',
          condition: 'lt',
          threshold: 200,
          timeWindow: 24,
        });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('P95 Latency');
      expect(res.body.metric).toBe('http_req_duration');
      expect(res.body.condition).toBe('lt');
      expect(res.body.threshold).toBe(200);
      expect(res.body.timeWindow).toBe(24);
      expect(res.body.enabled).toBe(true);
      expect(res.body.id).toBeTruthy();
      ruleId = res.body.id;
    });

    it('rejects invalid metric', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/sla/rules`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', metric: 'invalid', condition: 'lt', threshold: 100 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /projects/:pid/sla/rules', () => {
    it('lists SLA rules', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/sla/rules`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('_count');
      expect(res.body[0]._count).toHaveProperty('breaches');
    });
  });

  describe('PUT /sla/rules/:id', () => {
    it('updates an SLA rule', async () => {
      const res = await request(app)
        .put(`/api/v1/sla/rules/${ruleId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ threshold: 300, enabled: false });
      expect(res.status).toBe(200);
      expect(res.body.threshold).toBe(300);
      expect(res.body.enabled).toBe(false);
    });
  });

  describe('PATCH /sla/rules/:id/toggle', () => {
    it('toggles enabled state', async () => {
      const res = await request(app)
        .patch(`/api/v1/sla/rules/${ruleId}/toggle`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.enabled).toBe(true);
    });

    it('returns 404 for non-existent rule', async () => {
      const res = await request(app)
        .patch('/api/v1/sla/rules/00000000-0000-0000-0000-000000009999/toggle')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /projects/:pid/sla/status', () => {
    it('returns compliance status', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/sla/status`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('statuses');
      expect(res.body).toHaveProperty('evaluatedAt');
      expect(Array.isArray(res.body.statuses)).toBe(true);
    });
  });

  describe('GET /projects/:pid/sla/breaches', () => {
    it('lists breaches', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/sla/breaches`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('filters breaches by ruleId', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/sla/breaches?ruleId=${ruleId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('GET /projects/:pid/sla/report', () => {
    it('returns compliance report', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/sla/report`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('projectId', pid);
      expect(res.body).toHaveProperty('overallCompliance');
      expect(res.body).toHaveProperty('totalRules');
      expect(res.body).toHaveProperty('enabledRules');
      expect(res.body).toHaveProperty('totalBreaches');
      expect(res.body).toHaveProperty('rules');
      expect(Array.isArray(res.body.rules)).toBe(true);
    });
  });

  describe('GET /sla/rules/:id/breaches', () => {
    it('returns breaches for a specific rule', async () => {
      const res = await request(app)
        .get(`/api/v1/sla/rules/${ruleId}/breaches`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('DELETE /sla/rules/:id', () => {
    it('deletes an SLA rule', async () => {
      const res = await request(app)
        .delete(`/api/v1/sla/rules/${ruleId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      // Verify it's gone by trying to toggle (should 404)
      const toggleRes = await request(app)
        .patch(`/api/v1/sla/rules/${ruleId}/toggle`)
        .set('Authorization', `Bearer ${token}`);
      expect(toggleRes.status).toBe(404);
    });
  });
});