import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { gitRoutes } from '../git.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', gitRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Git Routes', () => {
  let token: string;
  let repoId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'gitusr@test.com', name: 'Git User', password: 'password123' });
    token = signup.status === 201 ? signup.body.token : (await request(app).post('/api/v1/auth/login').send({ email: 'gitusr@test.com', password: 'password123' })).body.token;
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  it('lists git repos (empty)', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/git`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('creates a git repo config', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${pid}/git`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Repo', repoUrl: 'https://github.com/test/repo.git', branch: 'main' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Repo');
    expect(res.body.repoUrl).toBe('https://github.com/test/repo.git');
    expect(res.body.branch).toBe('main');
    repoId = res.body.id;
  });

  it('lists git repos (with one)', async () => {
    const res = await request(app).get(`/api/v1/projects/${pid}/git`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].authToken).toBeNull();
  });

  it('rejects invalid repo URL', async () => {
    const res = await request(app)
      .post(`/api/v1/projects/${pid}/git`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Bad', repoUrl: 'not-a-url' });
    expect(res.status).toBe(400);
  });

  it('pushes script to git (succeeds when no git repos configured)', async () => {
    const script = await prisma.script.create({
      data: { projectId: pid, name: 'git-push-test', content: 'export default function() {}' },
    });
    const res = await request(app)
      .post(`/api/v1/scripts/${script.id}/git-push`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('deletes a git repo', async () => {
    const res = await request(app).delete(`/api/v1/git/${repoId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(204);
  });
});