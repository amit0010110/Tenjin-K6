import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { templateRoutes } from '../templates.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';
import { scriptRoutes } from '../scripts.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', templateRoutes);
  app.use('/api/v1', scriptRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000012';

describe('Templates Routes', () => {
  let token: string;

  beforeAll(async () => {
    await seedTestData();
    // Create project for our unique PID
    const existing = await prisma.project.findUnique({ where: { id: pid } });
    if (!existing) {
      await prisma.project.create({
        data: { id: pid, name: 'TPL Test Project', userId: '00000000-0000-0000-0000-000000000000' },
      });
    }
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'tpluser2@test.com', name: 'TPL User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'tpluser2@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('GET /templates', () => {
    it('lists all templates', async () => {
      const res = await request(app)
        .get('/api/v1/templates')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0]).toHaveProperty('id');
      expect(res.body[0]).toHaveProperty('name');
      expect(res.body[0]).toHaveProperty('category');
      expect(res.body[0]).toHaveProperty('content');
    });

    it('includes templates from all categories', async () => {
      const res = await request(app)
        .get('/api/v1/templates')
        .set('Authorization', `Bearer ${token}`);
      const categories = [...new Set(res.body.map((t: any) => t.category))];
      expect(categories).toContain('REST API');
      expect(categories).toContain('Database');
    });
  });

  describe('POST /templates/use', () => {
    let templateId: string;

    beforeAll(() => {
      templateId = 'rest-api-health';
    });

    it('creates a script from a template', async () => {
      const res = await request(app)
        .post('/api/v1/templates/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId, projectId: pid, name: 'Health Check Script' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Health Check Script');
      expect(res.body.content).toContain('__TARGET_URL__');
      expect(res.body.projectId).toBe(pid);
    });

    it('rejects missing templateId', async () => {
      const res = await request(app)
        .post('/api/v1/templates/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ projectId: pid });
      expect(res.status).toBe(400);
    });

    it('rejects unknown templateId', async () => {
      const res = await request(app)
        .post('/api/v1/templates/use')
        .set('Authorization', `Bearer ${token}`)
        .send({ templateId: 'non-existent', projectId: pid, name: 'Test' });
      expect(res.status).toBe(404);
    });
  });
});
