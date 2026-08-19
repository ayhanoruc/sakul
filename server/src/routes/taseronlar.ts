import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';

export const taseronlarRouter = Router();
const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };

const taseronSchema = z.object({
  ad: z.string().min(1).max(200),
  projeId: z.number().int().positive().nullish(),
  isKolu: z.string().max(100).nullish(),
  telefon: z.string().max(30).nullish(),
  anlasilanTutarKurus: z.number().int().positive().nullish(),
  aciklama: z.string().max(500).nullish(),
});

taseronlarRouter.get('/', (req, res) => {
  const base = db.select().from(schema.taseronlar);
  const rows = (req.query.proje ? base.where(eq(schema.taseronlar.projeId, Number(req.query.proje))) : base)
    .orderBy(asc(schema.taseronlar.ad))
    .all();
  res.json(rows);
});

taseronlarRouter.post('/', (req, res) => {
  const data = parseBody(taseronSchema, req, res);
  if (!data) return;
  res.status(201).json(db.insert(schema.taseronlar).values(data).returning().get());
});

taseronlarRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(taseronSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.taseronlar)
    .set({ ...data, ...touch })
    .where(eq(schema.taseronlar.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

taseronlarRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db.delete(schema.taseronlar).where(eq(schema.taseronlar.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
