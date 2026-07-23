import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.js';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      statusCode: 400,
      message: 'Validation error',
      details: err.errors,
    });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({
    statusCode: 500,
    message: 'Internal server error',
  });
}
