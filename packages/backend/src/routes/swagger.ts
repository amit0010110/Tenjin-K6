import { Router, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../lib/swagger.js';

export const swaggerRoutes = Router();

// Serve Swagger UI at /api-docs
swaggerRoutes.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'TenjinT6 API Docs',
}));

// Serve raw OpenAPI JSON
swaggerRoutes.get('/api-docs.json', (_req: Request, res: Response) => {
  res.json(swaggerSpec);
});
