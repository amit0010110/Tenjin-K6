import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { verifyToken } from '../lib/auth.js';
import { prisma } from '../lib/prisma.js';

declare global {
  namespace Express {
    interface Request {
      user?: { userId: string; email: string; role: string };
    }
  }
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;

  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7);

    // Try JWT first
    const jwtUser = verifyToken(token);
    if (jwtUser) {
      req.user = jwtUser;
      next();
      return;
    }

    // Fall back to PAT lookup
    try {
      const pat = await prisma.personalAccessToken.findFirst({
        where: { tokenHash: hashToken(token) },
        include: { user: { select: { id: true, email: true, role: true } } },
      });
      if (pat && pat.user) {
        if (pat.expiresAt && pat.expiresAt < new Date()) {
          res.status(401).json({ message: 'Token expired' });
          return;
        }
        req.user = { userId: pat.user.id, email: pat.user.email, role: pat.user.role };
        prisma.personalAccessToken.update({
          where: { id: pat.id },
          data: { lastUsedAt: new Date() },
        }).catch(() => {});
        next();
        return;
      }
    } catch {
      // fall through to rejection
    }

    // Bearer token provided but not valid
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }

  // No auth header — dev bypass for local development
  req.user = { userId: '00000000-0000-0000-0000-000000000000', email: 'dev@local', role: 'admin' };
  next();
}
