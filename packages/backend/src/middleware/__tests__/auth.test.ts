import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import { signToken, hashPassword } from '../../lib/auth.js';
import { prisma, initTestDb, seedTestData, cleanTestData } from '../../test/helpers.js';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', authMiddleware);
  app.get('/api/me', (req, res) => {
    res.json({ user: (req as any).user });
  });
  return app;
}

describe('auth middleware', () => {
  beforeAll(async () => {
    initTestDb();
    await seedTestData();
    await prisma.user.upsert({
      where: { id: 'auth-test-user' },
      update: {},
      create: { id: 'auth-test-user', email: 'authtest@dev.local', name: 'Auth Test', passwordHash: '' },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: ['auth-test-user'] } } });
  });

  it('bypasses auth when no header is present (dev mode)', async () => {
    const app = createApp();
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.userId).toBe('00000000-0000-0000-0000-000000000000');
  });

  it('returns 401 for invalid Bearer token', async () => {
    const app = createApp();
    const res = await request(app).get('/api/me').set('Authorization', 'Bearer invalid.jwt.token');
    expect(res.status).toBe(401);
  });

  it('accepts a valid JWT token', async () => {
    const token = signToken({ userId: 'auth-test-user', email: 'authtest@dev.local', role: 'user' });
    const app = createApp();
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('auth-test-user');
  });

  it('accepts a valid Personal Access Token', async () => {
    // Create a PAT
    const crypto = await import('crypto');
    const tokenValue = `gp6_test_${crypto.randomBytes(16).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(tokenValue).digest('hex');
    await prisma.personalAccessToken.create({
      data: { userId: 'auth-test-user', name: 'test-pat', tokenHash },
    });

    const app = createApp();
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${tokenValue}`);
    expect(res.status).toBe(200);
    expect(res.body.user.userId).toBe('auth-test-user');

    // Clean up
    await prisma.personalAccessToken.deleteMany({ where: { tokenHash } });
  });
});
