import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const projectRoutes = Router();

const createProjectSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  smtpConfig: z.string().optional(),
  k8sConfig: z.string().optional(),
});

const updateProjectSchema = createProjectSchema.partial();

function extractUserId(req: Request): string {
  return (req as any).user?.userId || '00000000-0000-0000-0000-000000000000';
}

/**
 * @openapi
 * /projects:
 *   get:
 *     tags: [Projects]
 *     summary: List projects for the authenticated user
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Project' }
 */
projectRoutes.get('/projects', async (req: Request, res: Response) => {
  const userId = extractUserId(req);

  const owned = await prisma.project.findMany({
    where: { userId },
    include: {
      _count: { select: { scripts: true, testRuns: true, members: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const memberProjectIds = await prisma.projectMember.findMany({
    where: { userId },
    select: { projectId: true },
  });

  let memberProjects: any[] = [];
  if (memberProjectIds.length > 0) {
    memberProjects = await prisma.project.findMany({
      where: { id: { in: memberProjectIds.map((m) => m.projectId) }, userId: { not: userId } },
      include: {
        _count: { select: { scripts: true, testRuns: true, members: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  res.json([...owned, ...memberProjects]);
});

/**
 * @openapi
 * /projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a new project
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       201:
 *         description: Project created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid input
 */
projectRoutes.post('/projects', async (req: Request, res: Response) => {
  const userId = extractUserId(req);
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }

  const project = await prisma.project.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description,
      userId,
    },
    include: {
      _count: { select: { scripts: true, testRuns: true, members: true } },
    },
  });

  logger.info({ projectId: project.id }, 'Project created');
  res.status(201).json(project);
});

/**
 * @openapi
 * /projects/{pid}:
 *   get:
 *     tags: [Projects]
 *     summary: Get a single project
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project details
 *       404:
 *         description: Project not found
 */
projectRoutes.get('/projects/:pid', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const project = await prisma.project.findUnique({
    where: { id: pid },
    include: {
      _count: { select: { scripts: true, testRuns: true, members: true } },
    },
  });
  if (!project) { res.status(404).json({ message: 'Project not found' }); return; }
  res.json(project);
});

/**
 * @openapi
 * /projects/{pid}:
 *   put:
 *     tags: [Projects]
 *     summary: Update a project
 *     security: [{ bearerAuth: [] }]
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
 *               name: { type: string }
 *               description: { type: string }
 *     responses:
 *       200:
 *         description: Project updated
 *       400:
 *         description: Invalid input
 */
projectRoutes.put('/projects/:pid', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const parsed = updateProjectSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues }); return; }

  const project = await prisma.project.update({
    where: { id: pid },
    data: parsed.data,
  });

  res.json(project);
});

/**
 * @openapi
 * /projects/{pid}/cloud-token:
 *   patch:
 *     tags: [Projects]
 *     summary: Update k6 Cloud token for a project
 *     security: [{ bearerAuth: [] }]
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
 *               token: { type: string }
 *     responses:
 *       200:
 *         description: Cloud token updated
 *       400:
 *         description: Invalid token
 */
projectRoutes.patch('/projects/:pid/cloud-token', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;
  const { token } = req.body;
  if (typeof token !== 'string') { res.status(400).json({ message: 'Invalid token' }); return; }

  const project = await prisma.project.update({
    where: { id: pid },
    data: { k6CloudToken: token || null },
    select: { id: true, name: true, k6CloudToken: true },
  });

  logger.info({ projectId: pid }, 'k6 Cloud token updated');
  res.json(project);
});

/**
 * @openapi
 * /projects/{pid}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete a project and all associated resources
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Project deleted
 */
projectRoutes.delete('/projects/:pid', async (req: Request, res: Response) => {
  const pid = req.params.pid as string;

  // Cascade clean up all related records
  await prisma.$transaction([
    prisma.testSuiteScript.deleteMany({ where: { suite: { projectId: pid } } }),
    prisma.testSuite.deleteMany({ where: { projectId: pid } }),
    prisma.alertEvent.deleteMany({ where: { alertRule: { projectId: pid } } }),
    prisma.alertRule.deleteMany({ where: { projectId: pid } }),
    prisma.gitRepo.deleteMany({ where: { projectId: pid } }),
    prisma.csvFile.deleteMany({ where: { projectId: pid } }),
    prisma.schedule.deleteMany({ where: { config: { projectId: pid } } }),
    prisma.thresholdResult.deleteMany({ where: { testRun: { projectId: pid } } }),
    prisma.testResultPoint.deleteMany({ where: { testRun: { projectId: pid } } }),
    prisma.testResult.deleteMany({ where: { testRun: { projectId: pid } } }),
    prisma.testRun.deleteMany({ where: { projectId: pid } }),
    prisma.testConfig.deleteMany({ where: { projectId: pid } }),
    prisma.environment.deleteMany({ where: { projectId: pid } }),
    prisma.script.deleteMany({ where: { projectId: pid } }),
    prisma.projectMember.deleteMany({ where: { projectId: pid } }),
    prisma.project.delete({ where: { id: pid } }),
  ]);

  logger.info({ projectId: pid }, 'Project deleted');
  res.json({ message: 'Deleted' });
});
