import type { Request, Response, NextFunction } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { sha256 } from '../lib/auth.js';
import { requireAuth } from './auth.js';

export type Scope = 'notes:write' | 'reminders:write';

/**
 * Auth for capture endpoints reachable from iOS Shortcuts:
 * a session cookie OR a scoped `Authorization: Bearer sakul_...` device token.
 * Device tokens are deliberately narrow — a stolen token can create notes and
 * reminders but can never read the knowledge base.
 */
export function requireAuthOrDeviceToken(scope: Scope) {
  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7).trim();
      const row = db.query.deviceTokens
        .findFirst({ where: eq(schema.deviceTokens.tokenHash, sha256(token)) })
        .sync();
      if (!row || row.revokedAt) {
        res.status(401).json({ error: 'invalid_token' });
        return;
      }
      if (!row.scopes.split(',').includes(scope)) {
        res.status(403).json({ error: 'insufficient_scope', required: scope });
        return;
      }
      db.update(schema.deviceTokens)
        .set({ lastUsedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
        .where(eq(schema.deviceTokens.id, row.id))
        .run();
      req.userId = row.userId;
      next();
      return;
    }
    requireAuth(req, res, next); // fall back to the session cookie
  };
}
