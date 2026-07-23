import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { logger } from '../lib/logger.js';

export const validationRoutes = Router();

const checkSchema = z.object({
  content: z.string().min(1),
});

/**
 * @openapi
 * /scripts/validate:
 *   post:
 *     tags: [Validation]
 *     summary: Validate a k6 script for common issues
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content: { type: string }
 *     responses:
 *       200:
 *         description: Validation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid: { type: boolean }
 *                 issues:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       line: { type: integer }
 *                       message: { type: string }
 *                       severity: { type: string, enum: [error, warning] }
 *       400:
 *         description: Invalid input
 */
validationRoutes.post('/scripts/validate', async (req: Request, res: Response) => {
  let body: z.infer<typeof checkSchema>;
  try {
    body = checkSchema.parse(req.body);
  } catch (err) {
    res.status(400).json({ message: 'Invalid request body', details: (err as Error).message });
    return;
  }
  const { content } = body;

  const issues: { line: number; message: string; severity: 'error' | 'warning' }[] = [];

  // Basic k6 script lint checks
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    const n = idx + 1;

    // No import statements for undefined modules
    if (/^import\s/.test(line.trim()) && !line.includes('k6/') && !line.includes('./') && !line.includes('../')) {
      issues.push({ line: n, message: `Unknown import: "${line.trim()}"`, severity: 'warning' });
    }

    // Check for common mistakes
    if (line.includes('http.get(') && !line.includes('check(')) {
      issues.push({ line: n, message: 'HTTP requests should typically be wrapped in check()', severity: 'warning' });
    }

    // Missing semicolons
    if (/^\s*(const|let|var)\s/.test(line) && !line.trim().endsWith(';') && !line.trim().endsWith('{') && !line.trim().endsWith('}') && !line.includes('//')) {
      // Only warn for lines that look like statements
      issues.push({ line: n, message: 'Missing semicolon', severity: 'warning' });
    }

    // Check for default function
    if (n === 1 && !line.includes('export default') && !line.includes('export function')) {
      // Only show if there's actual content
    }
  });

  // Must have a default function or export
  if (!content.includes('export default') && !content.includes('export function')) {
    issues.push({ line: 1, message: 'Script must have an "export default" function or "export function"', severity: 'error' });
  }

  // Must have options defined
  if (!content.includes('export const options')) {
    issues.push({ line: 1, message: 'Script should define "export const options" with test configuration', severity: 'warning' });
  }

  logger.info({ issueCount: issues.length }, 'Script validation completed');
  res.json({ valid: issues.filter((i) => i.severity === 'error').length === 0, issues });
});
