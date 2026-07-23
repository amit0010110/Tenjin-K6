import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { pluginRoutes } from '../plugins.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', pluginRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Plugin Routes', () => {
  let token: string;
  let pluginId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'plugusr@test.com', name: 'Plugin User', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'plugusr@test.com', password: 'password123' })).body.token;
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('lists plugins', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/plugins`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('creates a plugin', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${pid}/plugins`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'k6-browser', description: 'Browser testing', repoUrl: 'https://github.com/grafana/xk6-browser', version: '0.8.0' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('k6-browser');
    expect(res.body.enabled).toBe(true);
    expect(res.body.version).toBe('0.8.0');
    pluginId = res.body.id;
  });

  it('lists plugins after creating one', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/plugins`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('patches a plugin', async () => {
    const res = await request(app)
      .patch(`/api/v1/plugins/${pluginId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ enabled: false });
    expect(res.status).toBe(200);
    expect(res.body.enabled).toBe(false);
  });

  it('deletes a plugin', async () => {
    const res = await request(app).delete(`/api/v1/plugins/${pluginId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});