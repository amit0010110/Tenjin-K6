import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const configRoutes = Router();

const createConfigSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  options: z.record(z.unknown()),
  prometheusPushUrl: z.string().optional(),
  outputProfileId: z.string().nullable().optional(),
});

const updateConfigSchema = createConfigSchema.partial();

/**
 * @openapi
 * /scripts/{sid}/configs:
 *   get:
 *     tags: [Configs]
 *     summary: List all test configs for a script
 *     parameters:
 *       - in: path
 *         name: sid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of test configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/TestConfig' }
 */
configRoutes.get('/scripts/:sid/configs', async (req: Request, res: Response) => {
  const scriptId = req.params.sid as string;
  const configs = await prisma.testConfig.findMany({
    where: { scriptId },
    include: { outputProfile: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(configs);
});

/**
 * @openapi
 * /projects/{pid}/configs:
 *   get:
 *     tags: [Configs]
 *     summary: List all test configs for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of test configs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/TestConfig' }
 */
configRoutes.get('/projects/:pid/configs', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const configs = await prisma.testConfig.findMany({
    where: { projectId },
    include: { script: { select: { id: true, name: true } }, outputProfile: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(configs);
});

/**
 * @openapi
 * /scripts/{sid}/configs:
 *   post:
 *     tags: [Configs]
 *     summary: Create a test config for a script
 *     parameters:
 *       - in: path
 *         name: sid
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
 *               options: { type: object }
 *               prometheusPushUrl: { type: string }
 *               outputProfileId: { type: string }
 *     responses:
 *       201:
 *         description: Config created
 *       400:
 *         description: Invalid input
 *       404:
 *         description: Script not found
 */
configRoutes.post('/scripts/:sid/configs', async (req: Request, res: Response) => {
  const scriptId = req.params.sid as string;
  const body = createConfigSchema.parse(req.body);
  const script = await prisma.script.findUnique({ where: { id: scriptId }, select: { projectId: true } });
  if (!script) { res.status(404).json({ message: 'Script not found' }); return; }
  const config = await prisma.testConfig.create({
    data: {
      scriptId,
      projectId: script.projectId,
      name: body.name,
      description: body.description ?? null,
      options: JSON.stringify(body.options),
      prometheusPushUrl: body.prometheusPushUrl ?? null,
      outputProfileId: body.outputProfileId ?? null,
    },
    include: { outputProfile: true },
  });
  res.status(201).json(config);
});

/**
 * @openapi
 * /configs/{id}:
 *   put:
 *     tags: [Configs]
 *     summary: Update a test config
 *     parameters:
 *       - in: path
 *         name: id
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
 *               options: { type: object }
 *               prometheusPushUrl: { type: string }
 *               outputProfileId: { type: string }
 *     responses:
 *       200:
 *         description: Updated config
 */
configRoutes.put('/configs/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = updateConfigSchema.parse(req.body);
  const data: Record<string, unknown> = {};
  if (body.name !== undefined) data.name = body.name;
  if (body.description !== undefined) data.description = body.description;
  if (body.options !== undefined) data.options = JSON.stringify(body.options);
  if (body.prometheusPushUrl !== undefined) data.prometheusPushUrl = body.prometheusPushUrl;
  if (body.outputProfileId !== undefined) data.outputProfileId = body.outputProfileId;
  const config = await prisma.testConfig.update({ where: { id }, data, include: { outputProfile: true } });
  res.json(config);
});

/**
 * @openapi
 * /configs/{id}:
 *   delete:
 *     tags: [Configs]
 *     summary: Delete a test config
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Config deleted
 */
configRoutes.delete('/configs/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.testConfig.delete({ where: { id } });
  res.status(204).send();
});
