import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';
import { rematerialize, cleanupDerived } from '../worker/materialize.js';

export const malzemelerRouter = Router();
const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const malzemeSchema = z.object({
  projeId: z.number().int().positive(),
  ad: z.string().min(1).max(200),
  tedarikci: z.string().max(200).nullish(),
  miktar: z.number().positive().nullish(),
  birim: z.string().max(20).nullish(),
  siparisTarihi: dateStr.nullish(),
  teslimTarihi: dateStr.nullish(),
  teslimAlindiMi: z.union([z.literal(0), z.literal(1)]).default(0),
});

malzemelerRouter.get('/', (req, res) => {
  const base = db.select().from(schema.malzemeler);
  const rows = (req.query.proje ? base.where(eq(schema.malzemeler.projeId, Number(req.query.proje))) : base)
    .orderBy(asc(schema.malzemeler.teslimTarihi))
    .all();
  res.json(rows);
});

malzemelerRouter.post('/', (req, res) => {
  const data = parseBody(malzemeSchema, req, res);
  if (!data) return;
  const row = db.insert(schema.malzemeler).values(data).returning().get();
  rematerialize('malzemeler', row.id); // delivery-day reminder: T-0
  res.status(201).json(row);
});

malzemelerRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(malzemeSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.malzemeler)
    .set({ ...data, ...touch })
    .where(eq(schema.malzemeler.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  rematerialize('malzemeler', id); // delivered → pending reminder disappears
  res.json(row);
});

malzemelerRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  cleanupDerived('malzemeler', id);
  const row = db.delete(schema.malzemeler).where(eq(schema.malzemeler.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
