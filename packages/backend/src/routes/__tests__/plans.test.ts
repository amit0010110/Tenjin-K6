import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { planRoutes } from '../plans.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', planRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000010';

describe('Test Plans Routes', () => {
  let token: string;
  let planId: string;

  beforeAll(async () => {
    await seedTestData();
    // Create project for our unique PID
    const existing = await prisma.project.findUnique({ where: { id: pid } });
    if (!existing) {
      await prisma.project.create({
        data: { id: pid, name: 'Plans Test Project', userId: '00000000-0000-0000-0000-000000000000' },
      });
    }
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'planuser2@test.com', name: 'Plan User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'planuser2@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /projects/:pid/plans', () => {
    it('creates a test plan', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Load Test Plan', description: 'Main load test', blocks: '[{"type":"http-request"}]' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Load Test Plan');
      expect(res.body.description).toBe('Main load test');
      expect(res.body.projectId).toBe(pid);
      planId = res.body.id;
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '' });
      expect(res.status).toBe(400);
    });

    it('creates plan with defaults', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Minimal Plan' });
      expect(res.status).toBe(201);
      expect(res.body.blocks).toBe('[]');
    });
  });

  describe('GET /projects/:pid/plans', () => {
    it('lists plans for a project', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0]).toHaveProperty('_count');
    });
  });

  describe('GET /plans/:id', () => {
    it('gets a plan by id', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Get Test Plan' });
      const res = await request(app)
        .get(`/api/v1/plans/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Get Test Plan');
      expect(res.body).toHaveProperty('scripts');
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .get('/api/v1/plans/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /plans/:id', () => {
    it('updates a plan', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Update Test Plan' });
      const res = await request(app)
        .put(`/api/v1/plans/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Plan', description: 'Updated description' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Plan');
      expect(res.body.description).toBe('Updated description');
    });

    it('updates blocks only', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Blocks Test', blocks: '[{"type":"http"}]' });
      const res = await request(app)
        .put(`/api/v1/plans/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ blocks: '[{"type":"check"}]' });
      expect(res.status).toBe(200);
      expect(res.body.blocks).toBe('[{"type":"check"}]');
      expect(res.body.name).toBe('Blocks Test');
    });

    it('returns 404 for non-existent plan', async () => {
      const res = await request(app)
        .put('/api/v1/plans/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /plans/:id', () => {
    it('deletes a plan', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/plans`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Delete Test Plan' });
      const res = await request(app)
        .delete(`/api/v1/plans/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const get = await request(app)
        .get(`/api/v1/plans/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(get.status).toBe(404);
    });

    it('returns 404 for already deleted plan', async () => {
      const res = await request(app)
        .delete('/api/v1/plans/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
