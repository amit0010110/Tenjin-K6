import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const memberRoutes = Router();

/**
 * @openapi
 * /projects/{pid}/members:
 *   get:
 *     tags: [Members]
 *     summary: List members of a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of project members
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/ProjectMember' }
 */
memberRoutes.get('/projects/:pid/members', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
    orderBy: { createdAt: 'asc' },
  });
  res.json(members);
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'member', 'viewer']).optional(),
});

/**
 * @openapi
 * /projects/{pid}/members:
 *   post:
 *     tags: [Members]
 *     summary: Invite a user to a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email: { type: string, format: email }
 *               role: { type: string, enum: [admin, member, viewer] }
 *     responses:
 *       201:
 *         description: Member added
 *       404:
 *         description: User not found
 *       409:
 *         description: User is already a member
 */
memberRoutes.post('/projects/:pid/members', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  let body: z.infer<typeof inviteSchema>;
  try {
    body = inviteSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) {
    res.status(404).json({ message: 'User not found. They must sign up first.' });
    return;
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (existing) {
    res.status(409).json({ message: 'User is already a member' });
    return;
  }

  const member = await prisma.projectMember.create({
    data: { projectId, userId: user.id, role: body.role || 'member' },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });

  logger.info({ memberId: member.id, projectId, email: body.email }, 'Member added to project');
  res.status(201).json(member);
});

const updateMemberSchema = z.object({ role: z.enum(['admin', 'member', 'viewer']) });

/**
 * @openapi
 * /projects/{pid}/members/{memberId}:
 *   put:
 *     tags: [Members]
 *     summary: Update a member's role
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               role: { type: string, enum: [admin, member, viewer] }
 *     responses:
 *       200:
 *         description: Member role updated
 */
memberRoutes.put('/projects/:pid/members/:memberId', async (req: Request, res: Response) => {
  const { pid, memberId } = req.params as { pid: string; memberId: string };
  let body: z.infer<typeof updateMemberSchema>;
  try {
    body = updateMemberSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }

  const member = await prisma.projectMember.update({
    where: { id: memberId },
    data: { role: body.role },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  res.json(member);
});

/**
 * @openapi
 * /projects/{pid}/members/{memberId}:
 *   delete:
 *     tags: [Members]
 *     summary: Remove a member from a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Member removed
 */
memberRoutes.delete('/projects/:pid/members/:memberId', async (req: Request, res: Response) => {
  const { pid, memberId } = req.params as { pid: string; memberId: string };
  await prisma.projectMember.delete({ where: { id: memberId } });
  logger.info({ memberId, projectId: pid }, 'Member removed from project');
  res.status(204).end();
});

// Short-form aliases for convenience
memberRoutes.patch('/members/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const member = await prisma.projectMember.update({
    where: { id },
    data: { role: req.body.role },
    include: { user: { select: { id: true, email: true, name: true, role: true } } },
  });
  res.json(member);
});

memberRoutes.delete('/members/:id', async (req: Request, res: Response) => {
  await prisma.projectMember.delete({ where: { id: req.params.id as string } });
  res.status(204).end();
});
