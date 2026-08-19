import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';
import { rematerialize, cleanupDerived } from '../worker/materialize.js';

export const ceklerRouter = Router();
const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const cekSchema = z.object({
  yon: z.enum(['verilen', 'alinan']),
  karsiTaraf: z.string().min(1).max(200),
  tutarKurus: z.number().int().positive(),
  vadeTarihi: dateStr,
  banka: z.string().max(100).nullish(),
  cekNo: z.string().max(50).nullish(),
  projeId: z.number().int().positive().nullish(),
  dosyaId: z.number().int().positive().nullish(),
  durum: z.enum(['beklemede', 'odendi', 'karsiliksiz', 'iptal']).default('beklemede'),
});

ceklerRouter.get('/', (req, res) => {
  const base = db.select().from(schema.cekler);
  const rows = (
    req.query.durum ? base.where(eq(schema.cekler.durum, String(req.query.durum) as 'beklemede')) : base
  )
    .orderBy(asc(schema.cekler.vadeTarihi))
    .all();
  res.json(rows);
});

ceklerRouter.post('/', (req, res) => {
  const data = parseBody(cekSchema, req, res);
  if (!data) return;
  const row = db.insert(schema.cekler).values(data).returning().get();
  rematerialize('cekler', row.id); // vade warnings: T-7, T-1, T-0
  res.status(201).json(row);
});

ceklerRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(cekSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.cekler)
    .set({ ...data, ...touch })
    .where(eq(schema.cekler.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  rematerialize('cekler', id); // paid/cancelled çeks lose their pending warnings
  res.json(row);
});

ceklerRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  cleanupDerived('cekler', id);
  const row = db.delete(schema.cekler).where(eq(schema.cekler.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
