import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const patRoutes = Router();

const createPatSchema = z.object({
  name: z.string().min(1).max(255),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().optional(),
});

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function extractUserId(req: Request): string {
  return (req as any).user?.userId || '00000000-0000-0000-0000-000000000000';
}

function generatePatToken(): string {
  const raw = crypto.randomBytes(32).toString('hex');
  return `gp6_${raw}`;
}

/**
 * @openapi
 * /pats:
 *   get:
 *     tags: [Personal Access Tokens]
 *     summary: List personal access tokens (without token value)
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of PATs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/PersonalAccessToken' }
 */
patRoutes.get('/pats', async (req: Request, res: Response) => {
  const userId = extractUserId(req);
  const tokens = await prisma.personalAccessToken.findMany({
    where: { userId },
    select: { id: true, name: true, scopes: true, expiresAt: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(tokens);
});

/**
 * @openapi
 * /pats:
 *   post:
 *     tags: [Personal Access Tokens]
 *     summary: Create a personal access token
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               scopes: { type: array, items: { type: string } }
 *               expiresAt: { type: string, format: date-time }
 *     responses:
 *       201:
 *         description: PAT created (token value returned once)
 *       400:
 *         description: Invalid input
 */
patRoutes.post('/pats', async (req: Request, res: Response) => {
  const userId = extractUserId(req);
  const parsed = createPatSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }

  const token = generatePatToken();
  const tokenHash = hashToken(token);

  const pat = await prisma.personalAccessToken.create({
    data: {
      userId,
      name: parsed.data.name,
      tokenHash,
      scopes: JSON.stringify(parsed.data.scopes ?? ['*']),
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    },
  });

  logger.info({ patId: pat.id }, 'Personal access token created');

  res.status(201).json({
    id: pat.id,
    name: pat.name,
    token, // plaintext — only shown once
    scopes: pat.scopes,
    expiresAt: pat.expiresAt,
    createdAt: pat.createdAt,
  });
});

/**
 * @openapi
 * /pats/{id}:
 *   delete:
 *     tags: [Personal Access Tokens]
 *     summary: Revoke a personal access token
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Token revoked
 *       404:
 *         description: Token not found
 */
patRoutes.delete('/pats/:id', async (req: Request, res: Response) => {
  const userId = extractUserId(req);
  const id = req.params.id as string;
  const pat = await prisma.personalAccessToken.findFirst({ where: { id, userId } });
  if (!pat) { res.status(404).json({ message: 'Token not found' }); return; }

  await prisma.personalAccessToken.delete({ where: { id } });
  logger.info({ patId: id }, 'Personal access token revoked');
  res.json({ message: 'Revoked' });
});
