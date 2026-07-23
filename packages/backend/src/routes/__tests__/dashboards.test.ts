import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { dashboardsRoutes } from '../dashboards.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', dashboardsRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Dashboards CRUD Routes', () => {
  let token: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app).post('/api/v1/auth/signup').send({ email: 'dbcrud@test.com', name: 'DBCRUD', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'dbcrud@test.com', password: 'password123' })).body.token;
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('lists dashboards (empty)', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${pid}/dashboards`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates a dashboard', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${pid}/dashboards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Dashboard', widgets: '[]' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Dashboard');
    expect(res.body.projectId).toBe(pid);
  });

  it('gets a dashboard by id', async () => {
    const create = await request(app)
      .post(`/api/v1/projects/${pid}/dashboards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Test Dashboard' });

    const res = await request(app)
      .get(`/api/v1/dashboards/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(create.body.id);
  });

  it('updates a dashboard', async () => {
    const create = await request(app)
      .post(`/api/v1/projects/${pid}/dashboards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Old Name' });

    const res = await request(app)
      .put(`/api/v1/dashboards/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
  });

  it('deletes a dashboard', async () => {
    const create = await request(app)
      .post(`/api/v1/projects/${pid}/dashboards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'To Delete' });

    const res = await request(app)
      .delete(`/api/v1/dashboards/${create.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });

  it('returns 404 for non-existent dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/dashboards/00000000-0000-0000-0000-000000009999')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  it('creates dashboard with default widgets', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${pid}/dashboards`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Default Widgets' });
    expect(res.status).toBe(201);
    expect(res.body.widgets).toBe('[]');
  });
});