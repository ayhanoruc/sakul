import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';

export const notlarRouter = Router();

const notSchema = z.object({
  icerik: z.string().min(1).max(10_000),
  projeId: z.number().int().positive().nullish(),
  kaynak: z.enum(['pwa', 'shortcut', 'telegram']).default('pwa'),
});

notlarRouter.get('/', (req, res) => {
  const projeId = req.query.proje ? Number(req.query.proje) : null;
  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const base = db.select().from(schema.notlar);
  const rows = (projeId ? base.where(eq(schema.notlar.projeId, projeId)) : base)
    .orderBy(desc(schema.notlar.createdAt))
    .limit(limit)
    .all();
  res.json(rows);
});

notlarRouter.post('/', (req, res) => {
  const data = parseBody(notSchema, req, res);
  if (!data) return;
  const row = db.insert(schema.notlar).values(data).returning().get();
  res.status(201).json(row);
});

notlarRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(notSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.notlar)
    .set({ ...data, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(eq(schema.notlar.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

notlarRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db.delete(schema.notlar).where(eq(schema.notlar.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
