import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { prisma, seedTestData, cleanTestData, createTestApp } from '../../test/helpers.js';
import { errorHandler } from '../../middleware/errorHandler.js';
import { memberRoutes } from '../members.js';
import { authRoutes } from '../auth.js';
import { authMiddleware } from '../../middleware/auth.js';

function buildApp() {
  const app = createTestApp();
  app.use('/api/v1/auth', authRoutes);
  app.use('/api/v1', authMiddleware);
  app.use('/api/v1', memberRoutes);
  app.use(errorHandler);
  return app;
}

let app: ReturnType<typeof buildApp>;
const pid = '00000000-0000-0000-0000-000000000001';

describe('Members Routes', () => {
  let token: string;
  let memberId: string;

  beforeAll(async () => {
    await seedTestData();
    app = buildApp();
    const signup = await request(app)
      .post('/api/v1/auth/signup')
      .send({ email: 'memberuser@test.com', name: 'Member User', password: 'password123' });
    if (signup.status === 201) {
      token = signup.body.token;
    } else {
      const login = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'memberuser@test.com', password: 'password123' });
      token = login.body.token;
    }
  });

  afterAll(async () => {
    await cleanTestData();
    await prisma.$disconnect();
  });

  describe('GET /projects/:pid/members', () => {
    it('lists members (initially empty)', async () => {
      const res = await request(app)
        .get(`/api/v1/projects/${pid}/members`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /projects/:pid/members', () => {
    it('returns 404 when inviting non-existent user', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'nobody@test.com' });
      expect(res.status).toBe(404);
      expect(res.body.message).toContain('User not found');
    });

    it('invites an existing user', async () => {
      // Create a user to invite
      await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'invitee@test.com', name: 'Invitee', password: 'password123' });

      const res = await request(app)
        .post(`/api/v1/projects/${pid}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'invitee@test.com', role: 'member' });
      expect(res.status).toBe(201);
      expect(res.body.role).toBe('member');
      expect(res.body.user.email).toBe('invitee@test.com');
      memberId = res.body.id;
    });

    it('returns 409 when inviting duplicate member', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'invitee@test.com' });
      expect(res.status).toBe(409);
      expect(res.body.message).toContain('already a member');
    });

    it('rejects invalid email', async () => {
      const res = await request(app)
        .post(`/api/v1/projects/${pid}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'not-an-email' });
      expect(res.status).toBe(400);
    });
  });

  describe('PUT /projects/:pid/members/:memberId', () => {
    it('updates a member role', async () => {
      const res = await request(app)
        .put(`/api/v1/projects/${pid}/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'admin' });
      expect(res.status).toBe(200);
      expect(res.body.role).toBe('admin');
    });
  });

  describe('DELETE /projects/:pid/members/:memberId', () => {
    it('deletes a member', async () => {
      const res = await request(app)
        .delete(`/api/v1/projects/${pid}/members/${memberId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });

  describe('DELETE /members/:id', () => {
    it('deletes a member by shortcut', async () => {
      // Re-invite to have a member to delete
      await request(app)
        .post('/api/v1/auth/signup')
        .send({ email: 'shortcut@test.com', name: 'Shortcut', password: 'password123' });
      const invite = await request(app)
        .post(`/api/v1/projects/${pid}/members`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'shortcut@test.com' });
      const shortcutId = invite.body.id;

      const res = await request(app)
        .delete(`/api/v1/members/${shortcutId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(204);
    });
  });
});
