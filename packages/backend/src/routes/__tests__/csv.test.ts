import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { csvRoutes } from '../csv.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', csvRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('CSV Routes', () => {
  let token: string;
  let csvId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'csvuser@test.com', name: 'CSV User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'csvuser@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /projects/:pid/csv', () => {
    it('uploads a CSV file', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/csv`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Data', content: 'id,name,value\n1,foo,100\n2,bar,200' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test Data');
      expect(res.body.filename).toBe('test_data.csv');
      csvId = res.body.id;
    });

    it('rejects empty name', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/csv`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', content: 'a,b\n1,2' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /projects/:pid/csv', () => {
    it('lists CSV files', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/csv`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].name).toBe('Test Data');
    });
  });

  describe('GET /csv/:id', () => {
    it('gets a CSV file with content', async () => {
      const res = await request(app)
        .get(`/api/v1/csv/${csvId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.content).toContain('id,name,value');
    });

    it('returns 404 for non-existent CSV', async () => {
      const res = await request(app)
        .get('/api/v1/csv/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /csv/:id', () => {
    it('deletes a CSV file', async () => {
      const res = await request(app)
        .delete(`/api/v1/csv/${csvId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });
});
