import { Router } from 'express';
import { z } from 'zod';
import { asc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';
import { rematerialize, cleanupDerived } from '../worker/materialize.js';

export const belgelerRouter = Router();
const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };
const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const belgeSchema = z.object({
  projeId: z.number().int().positive(),
  tur: z.enum(['ruhsat', 'temel_vizesi', 'iskan', 'yapi_denetim', 'sgk', 'sigorta', 'diger']),
  verilisTarihi: dateStr.nullish(),
  gecerlilikBitis: dateStr.nullish(),
  dosyaId: z.number().int().positive().nullish(),
  aciklama: z.string().max(500).nullish(),
});

belgelerRouter.get('/', (req, res) => {
  const base = db.select().from(schema.belgeler);
  const rows = (req.query.proje ? base.where(eq(schema.belgeler.projeId, Number(req.query.proje))) : base)
    .orderBy(asc(schema.belgeler.gecerlilikBitis))
    .all();
  res.json(rows);
});

belgelerRouter.post('/', (req, res) => {
  const data = parseBody(belgeSchema, req, res);
  if (!data) return;
  const row = db.insert(schema.belgeler).values(data).returning().get();
  rematerialize('belgeler', row.id); // expiry warnings: T-30, T-7, T-1
  res.status(201).json(row);
});

belgelerRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(belgeSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.belgeler)
    .set({ ...data, ...touch })
    .where(eq(schema.belgeler.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  rematerialize('belgeler', id);
  res.json(row);
});

belgelerRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  cleanupDerived('belgeler', id);
  const row = db.delete(schema.belgeler).where(eq(schema.belgeler.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
