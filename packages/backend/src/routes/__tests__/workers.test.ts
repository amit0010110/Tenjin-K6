import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { workerRoutes } from '../workers.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', workerRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Workers Routes', () => {
  let token: string;
  let workerId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'workeruser@test.com', name: 'Worker User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'workeruser@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('creates a worker', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${pid}/workers`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Worker-1', url: 'http://worker1:8080', capacity: 50 });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Worker-1');
    expect(res.body.status).toBe('offline');
    expect(res.body.capacity).toBe(50);
    workerId = res.body.id;
  });

  it('lists workers', async () => {
    const res = await request(app)
      .get(`/api/v1/projects/${pid}/workers`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  // Distribute while worker is still offline
  it('returns 400 when no online workers for distribution', async () => {
    const script = await prisma.script.create({
      data: { projectId: pid, name: 'dist-test-script', content: 'export default function() {}' },
    });
    const run = await prisma.testRun.create({
      data: { projectId: pid, scriptId: script.id, userId: '00000000-0000-0000-0000-000000000000', status: 'pending' },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${pid}/runs/${run.id}/distribute`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('No online workers');
  });

  it('updates a worker', async () => {
    const res = await request(app)
      .patch(`/api/v1/workers/${workerId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ capacity: 200, status: 'online' });
    expect(res.status).toBe(200);
    expect(res.body.capacity).toBe(200);
    expect(res.body.status).toBe('online');
  });

  // Distribute while worker is online
  it('distributes run across workers', async () => {
    const script = await prisma.script.create({
      data: { projectId: pid, name: 'dist-test-script-2', content: 'export default function() {}' },
    });
    const run = await prisma.testRun.create({
      data: { projectId: pid, scriptId: script.id, userId: '00000000-0000-0000-0000-000000000000', status: 'pending' },
    });

    const res = await request(app)
      .post(`/api/v1/projects/${pid}/runs/${run.id}/distribute`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.workers.length).toBe(1);
    expect(res.body.workers[0].workerId).toBe(workerId);
  });

  it('receives heartbeat', async () => {
    const res = await request(app)
      .post(`/api/v1/workers/${workerId}/heartbeat`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.worker.status).toBe('online');
    expect(res.body.worker.lastHeartbeat).toBeTruthy();
  });

  it('deletes a worker', async () => {
    const res = await request(app)
      .delete(`/api/v1/workers/${workerId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });
});
