import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

type Role = 'admin' | 'editor' | 'viewer' | 'executor';

const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  editor: 60,
  executor: 30,
  viewer: 10,
};

const PERMISSIONS: Record<string, Role[]> = {
  // Scripts
  'scripts:create': ['admin', 'editor'],
  'scripts:read': ['admin', 'editor', 'viewer', 'executor'],
  'scripts:update': ['admin', 'editor'],
  'scripts:delete': ['admin'],
  // Configs
  'configs:create': ['admin', 'editor'],
  'configs:read': ['admin', 'editor', 'viewer', 'executor'],
  'configs:update': ['admin', 'editor'],
  'configs:delete': ['admin'],
  // Runs
  'runs:trigger': ['admin', 'editor', 'executor'],
  'runs:read': ['admin', 'editor', 'viewer', 'executor'],
  'runs:abort': ['admin', 'editor', 'executor'],
  'runs:delete': ['admin'],
  // Schedules
  'schedules:create': ['admin', 'editor'],
  'schedules:read': ['admin', 'editor', 'viewer'],
  'schedules:update': ['admin', 'editor'],
  'schedules:delete': ['admin'],
  // Suites
  'suites:create': ['admin', 'editor'],
  'suites:read': ['admin', 'editor', 'viewer'],
  'suites:update': ['admin', 'editor'],
  'suites:delete': ['admin'],
  // Workers
  'workers:create': ['admin', 'editor'],
  'workers:read': ['admin', 'editor', 'viewer'],
  'workers:delete': ['admin'],
  // Alerts
  'alerts:create': ['admin', 'editor'],
  'alerts:read': ['admin', 'editor', 'viewer'],
  'alerts:update': ['admin', 'editor'],
  'alerts:delete': ['admin'],
  // Members
  'members:invite': ['admin'],
  'members:read': ['admin', 'editor', 'viewer'],
  'members:update': ['admin'],
  'members:remove': ['admin'],
  // Settings
  'settings:read': ['admin', 'editor', 'viewer'],
  'settings:update': ['admin'],
};

export function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const pid = req.params.pid || req.body?.projectId;
    if (!pid) { next(); return; }

    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ message: 'Not authenticated' }); return; }

    // Project owner has full access
    const project = await prisma.project.findUnique({ where: { id: pid as string } });
    if (project?.userId === userId) { next(); return; }

    // Check membership
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: pid as string, userId } },
    });

    if (!member) { res.status(403).json({ message: 'Not a member of this project' }); return; }

    const requiredRoles = PERMISSIONS[permission];
    if (!requiredRoles) { next(); return; }

    const userLevel = ROLE_HIERARCHY[member.role as Role] || 0;
    const allowed = requiredRoles.some((r) => userLevel >= ROLE_HIERARCHY[r]);

    if (!allowed) {
      res.status(403).json({ message: `Requires ${requiredRoles.join(' or ')} role` });
      return;
    }

    next();
  };
}
