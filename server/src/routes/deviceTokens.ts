import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { sha256 } from '../lib/auth.js';
import { parseBody, idParam } from '../lib/validate.js';

export const deviceTokensRouter = Router();

/** List: never exposes token material — only names + state, for the management UI. */
deviceTokensRouter.get('/', (_req, res) => {
  const rows = db
    .select({
      id: schema.deviceTokens.id,
      name: schema.deviceTokens.name,
      scopes: schema.deviceTokens.scopes,
      lastUsedAt: schema.deviceTokens.lastUsedAt,
      revokedAt: schema.deviceTokens.revokedAt,
      createdAt: schema.deviceTokens.createdAt,
    })
    .from(schema.deviceTokens)
    .orderBy(desc(schema.deviceTokens.createdAt))
    .all();
  res.json(rows);
});

/** Create: the token is returned ONCE, stored only as a hash. */
deviceTokensRouter.post('/', (req, res) => {
  const data = parseBody(z.object({ name: z.string().min(1).max(100) }), req, res);
  if (!data) return;
  const token = `sakul_${crypto.randomBytes(32).toString('base64url')}`;
  const row = db
    .insert(schema.deviceTokens)
    .values({
      tokenHash: sha256(token),
      userId: req.userId!,
      name: data.name,
      scopes: 'notes:write,reminders:write',
    })
    .returning()
    .get();
  res.status(201).json({ id: row.id, name: row.name, scopes: row.scopes, token });
});

/** Revoke: lost phone = one tap. Revoked tokens stay listed as history. */
deviceTokensRouter.post('/:id/revoke', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db
    .update(schema.deviceTokens)
    .set({ revokedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(eq(schema.deviceTokens.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
