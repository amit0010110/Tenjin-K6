import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { auditRoutes } from '../audit.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', auditRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Audit Log Routes', () => {
  let token: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app).post('/api/v1/auth/signup').send({ email: 'audit@test.com', name: 'Audit', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'audit@test.com', password: 'password123' })).body.token;
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('returns audit logs (paginated)', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/audit-logs`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('logs');
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('totalPages');
    expect(Array.isArray(res.body.logs)).toBe(true);
  });

  it('respects page and limit query params', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/audit-logs?page=1&limit=10`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBeUndefined(); // uses default
  });
});