import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export async function createAuditLog(params: {
  projectId: string;
  userId: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
}) {
  try {
    await prisma.auditLog.create({ data: params });
  } catch (err) {
    logger.error({ err, params }, 'Failed to create audit log');
  }
}

export function auditLogMiddleware(action: string, entity: string) {
  return async (req: any, res: any, next: any) => {
    const originalJson = res.json.bind(res);
    res.json = function (body: any) {
      const entityId = req.params.id || req.params.pid || body?.id || 'unknown';
      createAuditLog({
        projectId: req.params.pid || body?.projectId || 'unknown',
        userId: req.user?.userId || 'unknown',
        action,
        entity,
        entityId,
        details: JSON.stringify({ method: req.method, path: req.path }),
      });
      return originalJson(body);
    };
    next();
  };
}
