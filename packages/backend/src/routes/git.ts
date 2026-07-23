import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { pushScriptToGit, pullScriptsFromGit } from '../lib/gitSync.js';

export const gitRoutes = Router();

const createRepoSchema = z.object({
  name: z.string().min(1).max(255),
  repoUrl: z.string().url(),
  branch: z.string().optional(),
  authToken: z.string().optional(),
});

/**
 * @openapi
 * /projects/{pid}/git:
 *   get:
 *     tags: [Git]
 *     summary: List git repos for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of git repos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/GitRepo' }
 */
gitRoutes.get('/projects/:pid/git', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const repos = await prisma.gitRepo.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(repos.map((r) => ({ ...r, authToken: r.authToken ? '••••••••' : null })));
});

/**
 * @openapi
 * /projects/{pid}/git:
 *   post:
 *     tags: [Git]
 *     summary: Configure a git repo for a project
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
 *               repoUrl: { type: string, format: uri }
 *               branch: { type: string }
 *               authToken: { type: string }
 *     responses:
 *       201:
 *         description: Git repo configured
 */
gitRoutes.post('/projects/:pid/git', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  let body: z.infer<typeof createRepoSchema>;
  try {
    body = createRepoSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }
  const repo = await prisma.gitRepo.create({
    data: {
      projectId,
      name: body.name,
      repoUrl: body.repoUrl,
      branch: body.branch || 'main',
      authToken: body.authToken || null,
    },
  });
  logger.info({ repoId: repo.id, projectId, name: body.name }, 'Git repo configured');
  res.status(201).json({ ...repo, authToken: repo.authToken ? '••••••••' : null });
});

/**
 * @openapi
 * /git/{id}:
 *   delete:
 *     tags: [Git]
 *     summary: Delete a git repo configuration
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Git repo deleted
 */
gitRoutes.delete('/git/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.gitRepo.delete({ where: { id } });
  res.status(204).end();
});

/**
 * @openapi
 * /scripts/{sid}/git-push:
 *   post:
 *     tags: [Git]
 *     summary: Push a single script to its git repo
 *     parameters:
 *       - in: path
 *         name: sid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pushed to git
 *       400:
 *         description: Push failed
 */
gitRoutes.post('/scripts/:sid/git-push', async (req: Request, res: Response) => {
  const scriptId = req.params.sid as string;
  const error = await pushScriptToGit(scriptId);
  if (error) { res.status(400).json({ message: error }); return; }
  res.json({ message: 'Pushed to git' });
});

/**
 * @openapi
 * /projects/{pid}/git-pull:
 *   post:
 *     tags: [Git]
 *     summary: Pull scripts from git for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pulled from git
 *       400:
 *         description: Pull failed
 */
gitRoutes.post('/projects/:pid/git-pull', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const error = await pullScriptsFromGit(projectId);
  if (error) { res.status(400).json({ message: error }); return; }
  res.json({ message: 'Pulled from git' });
});
