import { Router } from 'express';
import { z } from 'zod';
import { desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';

export const projelerRouter = Router();

const projeSchema = z.object({
  ad: z.string().min(1).max(200),
  adres: z.string().max(500).nullish(),
  adaParsel: z.string().max(100).nullish(),
  malSahibi: z.string().max(200).nullish(),
  durum: z.enum(['aktif', 'tamamlandi', 'beklemede']).default('aktif'),
  baslangicTarihi: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  aciklama: z.string().max(2000).nullish(),
});

projelerRouter.get('/', (_req, res) => {
  const rows = db.select().from(schema.projeler).orderBy(desc(schema.projeler.createdAt)).all();
  res.json(rows);
});

projelerRouter.get('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db.query.projeler.findFirst({ where: eq(schema.projeler.id, id) }).sync();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

projelerRouter.post('/', (req, res) => {
  const data = parseBody(projeSchema, req, res);
  if (!data) return;
  const row = db.insert(schema.projeler).values(data).returning().get();
  res.status(201).json(row);
});

projelerRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(projeSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.projeler)
    .set({ ...data, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(eq(schema.projeler.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

projelerRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db.delete(schema.projeler).where(eq(schema.projeler.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
