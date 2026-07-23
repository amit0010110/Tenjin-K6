import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { hashPassword, verifyPassword, signToken } from '../lib/auth.js';
import { logger } from '../lib/logger.js';

export const authRoutes = Router();

const signupSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  password: z.string().min(6).max(128),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

/**
 * @openapi
 * /auth/signup:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, name, password]
 *             properties:
 *               email: { type: string, format: email }
 *               name: { type: string, minLength: 1 }
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       201:
 *         description: User created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Error' }
 */
authRoutes.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const body = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) {
    res.status(409).json({ message: 'Email already registered' });
    return;
  }

  const passwordHash = await hashPassword(body.password);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      passwordHash,
    },
  });

  // Create a default project for the user
  const project = await prisma.project.create({
    data: {
      name: `${body.name}'s Project`,
      description: 'Default project',
      userId: user.id,
    },
  });

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  logger.info({ userId: user.id }, 'User signed up');
  res.status(201).json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in with email and password
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token: { type: string }
 *                 user: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Invalid credentials
 */
authRoutes.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }
  const body = parsed.data;

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user || !user.passwordHash) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const valid = await verifyPassword(body.password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ message: 'Invalid email or password' });
    return;
  }

  const token = signToken({ userId: user.id, email: user.email, role: user.role });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Get current user profile
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Not authenticated
 */
authRoutes.get('/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Not authenticated' });
    return;
  }

  const { verifyToken } = await import('../lib/auth.js');
  const payload = verifyToken(header.slice(7));
  if (!payload) {
    res.status(401).json({ message: 'Invalid token' });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) {
    res.status(404).json({ message: 'User not found' });
    return;
  }

  res.json(user);
});

/** @openapi
 * /auth/me:
 *   put:
 *     tags: [Auth]
 *     summary: Update current user profile (name and/or password)
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string, minLength: 1 }
 *               currentPassword: { type: string, description: 'Required to change password' }
 *               newPassword: { type: string, minLength: 6, description: 'New password (leave empty to keep current)' }
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/User' }
 *       401:
 *         description: Invalid current password
 */
authRoutes.put('/me', async (req: Request, res: Response) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ message: 'Not authenticated' }); return; }

  const { verifyToken, hashPassword, verifyPassword } = await import('../lib/auth.js');
  const payload = verifyToken(header.slice(7));
  if (!payload) { res.status(401).json({ message: 'Invalid token' }); return; }

  const { name, currentPassword, newPassword } = req.body as { name?: string; currentPassword?: string; newPassword?: string };

  const data: Record<string, unknown> = {};
  if (name !== undefined) data.name = name;

  if (newPassword) {
    if (!currentPassword) { res.status(400).json({ message: 'currentPassword is required to change password' }); return; }
    const user = await prisma.user.findUnique({ where: { id: payload.userId } });
    if (!user?.passwordHash) { res.status(400).json({ message: 'Cannot change password for this account' }); return; }
    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) { res.status(401).json({ message: 'Current password is incorrect' }); return; }
    data.passwordHash = await hashPassword(newPassword);
  }

  const updated = await prisma.user.update({
    where: { id: payload.userId },
    data,
    select: { id: true, email: true, name: true, role: true },
  });

  res.json(updated);
});
