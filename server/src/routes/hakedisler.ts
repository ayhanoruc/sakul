import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';
import { rematerialize, cleanupDerived } from '../worker/materialize.js';

export const hakedislerRouter = Router();
const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const hakedisSchema = z.object({
  projeId: z.number().int().positive(),
  taseronId: z.number().int().positive().nullish(),
  yon: z.enum(['gelen', 'giden']),
  aciklama: z.string().max(500).nullish(),
  tutarKurus: z.number().int().positive(),
  vadeTarihi: dateStr.nullish(),
  odendiMi: z.union([z.literal(0), z.literal(1)]).default(0),
  odemeTarihi: dateStr.nullish(),
});

hakedislerRouter.get('/', (req, res) => {
  const base = db.select().from(schema.hakedisler);
  const rows = (req.query.proje ? base.where(eq(schema.hakedisler.projeId, Number(req.query.proje))) : base)
    .orderBy(asc(schema.hakedisler.vadeTarihi))
    .all();
  res.json(rows);
});

hakedislerRouter.post('/', (req, res) => {
  const data = parseBody(hakedisSchema, req, res);
  if (!data) return;
  const row = db.insert(schema.hakedisler).values(data).returning().get();
  rematerialize('hakedisler', row.id); // vade warnings: T-3, T-0
  res.status(201).json(row);
});

hakedislerRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(hakedisSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.hakedisler)
    .set({ ...data, ...touch })
    .where(eq(schema.hakedisler.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  rematerialize('hakedisler', id); // paid hakediş loses its pending warnings
  res.json(row);
});

hakedislerRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  cleanupDerived('hakedisler', id);
  const row = db.delete(schema.hakedisler).where(eq(schema.hakedisler.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
