import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

function safeJson(val: unknown): unknown {
  if (typeof val === 'string') { try { return JSON.parse(val); } catch { return val; } }
  return val;
}

export const scriptRoutes = Router();

const createScriptSchema = z.object({
  name: z.string().min(1).max(255),
  content: z.string().min(1),
  blocks: z.string().optional(),
  envVars: z.record(z.string()).optional(),
  tags: z.record(z.string()).optional(),
});

const updateScriptSchema = createScriptSchema.partial();

/**
 * @openapi
 * /projects/{pid}/scripts:
 *   get:
 *     tags: [Scripts]
 *     summary: List all scripts in a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of scripts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/Script' }
 */
scriptRoutes.get('/projects/:pid/scripts', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const scripts = await prisma.script.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true, version: true, createdAt: true, tags: true },
  });
  res.json(scripts);
});

/**
 * @openapi
 * /projects/{pid}/scripts:
 *   post:
 *     tags: [Scripts]
 *     summary: Create a new script in a project
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
 *               content: { type: string }
 *               envVars: { type: object }
 *               tags: { type: object }
 *     responses:
 *       201:
 *         description: Script created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Script'
 *       400:
 *         description: Invalid input
 */
scriptRoutes.post('/projects/:pid/scripts', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const body = createScriptSchema.parse(req.body);
  const script = await prisma.script.create({
    data: {
      projectId,
      name: body.name,
      content: body.content,
      blocks: body.blocks ?? null,
      envVars: JSON.stringify(body.envVars ?? {}),
      tags: JSON.stringify(body.tags ?? {}),
    },
  });
  logger.info({ scriptId: script.id }, 'Script created');
  res.status(201).json(script);
});

/**
 * @openapi
 * /scripts/{id}:
 *   get:
 *     tags: [Scripts]
 *     summary: Get a script by ID with full content
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Script details with content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Script'
 *       404:
 *         description: Script not found
 */
scriptRoutes.get('/scripts/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const raw = await prisma.script.findUnique({
    where: { id },
    include: { configs: { select: { id: true, name: true } } },
  });
  if (!raw) { res.status(404).json({ message: 'Script not found' }); return; }
  const script = { ...raw, envVars: safeJson(raw.envVars), tags: safeJson(raw.tags) };
  res.json(script);
});

/**
 * @openapi
 * /scripts/{id}:
 *   put:
 *     tags: [Scripts]
 *     summary: Update a script with auto-incrementing version
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
 *               content: { type: string }
 *               envVars: { type: object }
 *               tags: { type: object }
 *     responses:
 *       200:
 *         description: Updated script
 *       404:
 *         description: Script not found
 */
scriptRoutes.put('/scripts/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const body = updateScriptSchema.parse(req.body);
  const existing = await prisma.script.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Script not found' }); return; }

  // Save snapshot before updating
  await prisma.scriptVersion.create({
    data: {
      scriptId: id,
      version: existing.version,
      content: existing.content,
      envVars: existing.envVars,
      tags: existing.tags,
    },
  }).catch(() => { /* version snapshot already exists — skip */ });

  const script = await prisma.script.update({
    where: { id },
    data: {
      ...(body.name ? { name: body.name } : {}),
      ...(body.content ? { content: body.content } : {}),
      ...(body.blocks !== undefined ? { blocks: body.blocks } : {}),
      ...(body.envVars ? { envVars: JSON.stringify(body.envVars) } : {}),
      ...(body.tags ? { tags: JSON.stringify(body.tags) } : {}),
      version: existing.version + 1,
    },
  });
  res.json(script);
});

/**
 * @openapi
 * /scripts/{id}:
 *   delete:
 *     tags: [Scripts]
 *     summary: Delete a script
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Script deleted
 */
scriptRoutes.delete('/scripts/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  try {
    const existing = await prisma.script.findUnique({ where: { id } });
    if (!existing) { res.status(404).json({ message: 'Script not found' }); return; }

    await prisma.$transaction([
      prisma.testSuiteScript.deleteMany({ where: { scriptId: id } }),
      prisma.testRun.deleteMany({ where: { scriptId: id } }),
      prisma.testConfig.deleteMany({ where: { scriptId: id } }),
      prisma.script.delete({ where: { id } }),
    ]);
    res.status(204).send();
  } catch (err) {
    logger.error({ err, scriptId: id }, 'Failed to delete script');
    res.status(500).json({ message: 'Failed to delete script' });
  }
});

/**
 * @openapi
 * /scripts/{id}/versions:
 *   get:
 *     tags: [Scripts]
 *     summary: List version history for a script
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of versions
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id: { type: string, format: uuid }
 *                   version: { type: integer }
 *                   createdAt: { type: string, format: date-time }
 *       404:
 *         description: Script not found
 */
scriptRoutes.get('/scripts/:id/versions', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const script = await prisma.script.findUnique({ where: { id } });
  if (!script) { res.status(404).json({ message: 'Script not found' }); return; }
  const versions = await prisma.scriptVersion.findMany({
    where: { scriptId: id },
    orderBy: { version: 'desc' },
    select: { id: true, version: true, createdAt: true },
  });
  res.json(versions);
});

/**
 * @openapi
 * /scripts/{id}/versions/{versionId}:
 *   get:
 *     tags: [Scripts]
 *     summary: Get a specific version with full content
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Version details with content
 *       404:
 *         description: Version not found
 */
scriptRoutes.get('/scripts/:id/versions/:versionId', async (req: Request, res: Response) => {
  const { id, versionId } = req.params as { id: string; versionId: string };
  const version = await prisma.scriptVersion.findUnique({
    where: { id: versionId },
    select: { id: true, version: true, content: true, createdAt: true, scriptId: true },
  });
  if (!version || version.scriptId !== id) { res.status(404).json({ message: 'Version not found' }); return; }
  res.json({ id: version.id, version: version.version, content: version.content, createdAt: version.createdAt });
});

/** @openapi
 * /scripts/{id}/versions/{versionId}/restore:
 *   post:
 *     tags: [Scripts]
 *     summary: Restore a previous version of a script
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: versionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Script restored
 *       404:
 *         description: Version not found
 */
scriptRoutes.post('/scripts/:id/versions/:versionId/restore', async (req: Request, res: Response) => {
  const { id, versionId } = req.params as { id: string; versionId: string };
  const existing = await prisma.script.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Script not found' }); return; }

  const version = await prisma.scriptVersion.findUnique({ where: { id: versionId } });
  if (!version || version.scriptId !== id) { res.status(404).json({ message: 'Version not found' }); return; }

  // Save current as snapshot before restoring
  await prisma.scriptVersion.create({
    data: {
      scriptId: id,
      version: existing.version,
      content: existing.content,
      envVars: existing.envVars,
      tags: existing.tags,
    },
  }).catch(() => {});

  const script = await prisma.script.update({
    where: { id },
    data: {
      content: version.content,
      envVars: version.envVars,
      tags: version.tags,
      version: existing.version + 1,
    },
  });

  logger.info({ scriptId: id, restoredVersion: version.version, newVersion: script.version }, 'Script version restored');
  res.json(script);
});

scriptRoutes.put('/scripts/:id/blocks', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { blocks } = req.body;
  if (typeof blocks !== 'string') { res.status(400).json({ message: 'blocks must be a JSON string' }); return; }
  const existing = await prisma.script.findUnique({ where: { id } });
  if (!existing) { res.status(404).json({ message: 'Script not found' }); return; }
  await prisma.script.update({ where: { id }, data: { blocks } });
  res.json({ message: 'Blocks saved' });
});
