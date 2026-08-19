import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { SESSION_COOKIE, findSession } from '../lib/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: number;
  }
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return undefined;
}

/** Session cookie auth. (Device-token Bearer auth arrives in Stage 4 and slots in here.) */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = readCookie(req, SESSION_COOKIE);
  if (token) {
    const session = findSession(token);
    if (session) {
      const user = db.query.users.findFirst({ where: eq(schema.users.id, session.userId) }).sync();
      if (user) {
        req.userId = user.id;
        return next();
      }
    }
  }
  res.status(401).json({ error: 'unauthorized' });
}
