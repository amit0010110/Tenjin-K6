import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { environmentRoutes } from '../environments.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', environmentRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Environments Routes', () => {
  let token: string;
  let envId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'envuser@test.com', name: 'Env User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'envuser@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /projects/:pid/environments', () => {
    it('creates an environment', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Production', baseUrl: 'https://api.example.com', variables: { API_KEY: 'test' } });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Production');
      expect(res.body.baseUrl).toBe('https://api.example.com');
      expect(res.body.isDefault).toBe(true);
      envId = res.body.id;
    });

    it('creates a second environment (non-default)', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Staging', baseUrl: 'https://staging.example.com' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Staging');
      expect(res.body.isDefault).toBe(false);
    });

    it('rejects invalid body', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ baseUrl: 'not-a-url' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /projects/:pid/environments', () => {
    it('lists environments (default first)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(2);
      expect(res.body[0].isDefault).toBe(true);
    });
  });

  describe('PUT /environments/:id', () => {
    it('updates an environment', async () => {
      const res = await request(app)
        .put(`/api/v1/environments/${envId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Production Updated', baseUrl: 'https://api-v2.example.com' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Production Updated');
      expect(res.body.baseUrl).toBe('https://api-v2.example.com');
    });
  });

  describe('POST /environments/:id/set-default', () => {
    it('sets default environment', async () => {
      // Find the non-default env
      const list = await request(app)
        .get(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`);
      const staging = list.body.find((e: any) => e.name === 'Staging');
      expect(staging).toBeTruthy();

      const res = await request(app)
        .post(`/api/v1/environments/${staging.id}/set-default`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);

      const updated = await request(app)
        .get(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`);
      const defaultEnv = updated.body.find((e: any) => e.isDefault);
      expect(defaultEnv.name).toBe('Staging');
    });
  });

  describe('DELETE /environments/:id', () => {
    it('deletes an environment', async () => {
      const res = await request(app)
        .delete(`/api/v1/environments/${envId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const list = await request(app)
        .get(`/api/v1/projects/${pid}/environments`)
        .set('Authorization', `Bearer ${token}`);
      expect(list.body.length).toBe(1);
    });

    it('returns 404 for non-existent environment', async () => {
      const res = await request(app)
        .delete('/api/v1/environments/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
