import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export const csvRoutes = Router();

/**
 * @openapi
 * /projects/{pid}/csv:
 *   get:
 *     tags: [CSV]
 *     summary: List CSV files for a project
 *     parameters:
 *       - in: path
 *         name: pid
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of CSV files
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/CsvFile' }
 */
csvRoutes.get('/projects/:pid/csv', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const files = await prisma.csvFile.findMany({
    where: { projectId },
    select: { id: true, name: true, filename: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(files);
});

/**
 * @openapi
 * /projects/{pid}/csv:
 *   post:
 *     tags: [CSV]
 *     summary: Upload a CSV file to a project
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
 *     responses:
 *       201:
 *         description: CSV file created
 *       400:
 *         description: Invalid input
 */
csvRoutes.post('/projects/:pid/csv', async (req: Request, res: Response) => {
  const projectId = req.params.pid as string;
  const uploadSchema = z.object({
    name: z.string().min(1).max(255),
    content: z.string().min(1),
  });
  let body: z.infer<typeof uploadSchema>;
  try {
    body = uploadSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }

  // Infer filename from first line of CSV (header row)
  const firstLine = body.content.split('\n')[0]?.trim() || 'data.csv';
  const filename = `${body.name.replace(/\s+/g, '_').toLowerCase()}.csv`;

  const file = await prisma.csvFile.create({
    data: { projectId, name: body.name, filename, content: body.content },
  });

  logger.info({ csvId: file.id, projectId, name: body.name }, 'CSV file uploaded');
  res.status(201).json({ id: file.id, name: file.name, filename: file.filename, createdAt: file.createdAt });
});

/**
 * @openapi
 * /csv/{id}:
 *   get:
 *     tags: [CSV]
 *     summary: Get a CSV file by ID with content
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: CSV file with content
 *       404:
 *         description: CSV file not found
 */
csvRoutes.get('/csv/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const file = await prisma.csvFile.findUnique({ where: { id } });
  if (!file) { res.status(404).json({ message: 'CSV file not found' }); return; }
  res.json({ id: file.id, name: file.name, filename: file.filename, content: file.content, createdAt: file.createdAt });
});

/**
 * @openapi
 * /csv/{id}:
 *   delete:
 *     tags: [CSV]
 *     summary: Delete a CSV file
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: CSV file deleted
 */
csvRoutes.delete('/csv/:id', async (req: Request, res: Response) => {
  const id = req.params.id as string;
  await prisma.csvFile.delete({ where: { id } });
  res.status(204).end();
});
