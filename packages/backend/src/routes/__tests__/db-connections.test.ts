import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { dbConnectionRoutes } from '../db-connections.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', dbConnectionRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000011';

describe('DB Connections Routes', () => {
  let token: string;
  let connId: string;

  beforeAll(async () => {
    await seedTestData();
    // Create project for our unique PID
    const existing = await prisma.project.findUnique({ where: { id: pid } });
    if (!existing) {
      await prisma.project.create({
        data: { id: pid, name: 'DB Test Project', userId: '00000000-0000-0000-0000-000000000000' },
      });
    }
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'dbuser2@test.com', name: 'DB User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'dbuser2@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('POST /projects/:pid/db-connections', () => {
    it('creates a PostgreSQL connection', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Prod PG', type: 'postgres', host: 'pg.example.com', port: 5432, database: 'mydb', username: 'admin', password: 'secret', ssl: true });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Prod PG');
      expect(res.body.type).toBe('postgres');
      expect(res.body.host).toBe('pg.example.com');
      expect(res.body.ssl).toBe(true);
      connId = res.body.id;
    });

    it('creates a MySQL connection with defaults', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Dev MySQL', type: 'mysql' });
      expect(res.status).toBe(201);
      expect(res.body.type).toBe('mysql');
      expect(res.body.host).toBe('localhost');
      expect(res.body.port).toBe(5432);
      expect(res.body.ssl).toBe(false);
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ type: 'postgres' });
      expect(res.status).toBe(400);
    });

    it('rejects invalid type', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Bad', type: 'oracle' });
      expect(res.status).toBe(400);
    });

    it('creates a connection for later tests', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Conn', type: 'postgres' });
      expect(res.status).toBe(201);
      connId = res.body.id;
    });
  });

  describe('GET /projects/:pid/db-connections', () => {
    it('lists connections', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(3);
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('type');
    });
  });

  describe('GET /db-connections/:id', () => {
    it('gets a connection by id', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Get Test', type: 'postgres' });
      const res = await request(app)
        .get(`/api/v1/db-connections/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Get Test');
      expect(res.body.type).toBe('postgres');
    });

    it('returns 404 for non-existent connection', async () => {
      const res = await request(app)
        .get('/api/v1/db-connections/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /db-connections/:id', () => {
    it('updates a connection', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Update Test', type: 'postgres', host: 'old.example.com' });
      const res = await request(app)
        .put(`/api/v1/db-connections/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated PG', host: 'pg-new.example.com', password: 'newsecret' });
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated PG');
      expect(res.body.host).toBe('pg-new.example.com');
      expect(res.body.password).toBe('newsecret');
    });

    it('returns 404 for non-existent connection', async () => {
      const res = await request(app)
        .put('/api/v1/db-connections/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Nope' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /db-connections/:id', () => {
    it('deletes a connection', async () => {
      const create = await request(app)
        .post(`/api/v1/projects/${pid}/db-connections`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Delete Test', type: 'postgres' });
      const res = await request(app)
        .delete(`/api/v1/db-connections/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);

      const get = await request(app)
        .get(`/api/v1/db-connections/${create.body.id}`)
        .set('Authorization', `Bearer ${token}`);
      expect(get.status).toBe(404);
    });

    it('returns 404 for already deleted connection', async () => {
      const res = await request(app)
        .delete('/api/v1/db-connections/00000000-0000-0000-0000-000000009999')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);
    });
  });
});
