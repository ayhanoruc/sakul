import { Router } from 'express';
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody, idParam } from '../lib/validate.js';
import { isValidRule } from '../lib/recurrence.js';
import { unblockDependents } from '../worker/reminders.js';

export const hatirlaticilarRouter = Router();

const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };
const isoDateTime = z.string().datetime({ offset: true });

const baseSchema = z.object({
  baslik: z.string().min(1).max(300),
  detay: z.string().max(2000).nullish(),
  projeId: z.number().int().positive().nullish(),
});

// per-kind payloads — the discriminant makes invalid combinations unrepresentable
const createSchema = z.discriminatedUnion('tur', [
  baseSchema.extend({ tur: z.literal('sabit'), hatirlatmaZamani: isoDateTime }),
  baseSchema.extend({
    tur: z.literal('tekrarli'),
    hatirlatmaZamani: isoDateTime, // first occurrence
    tekrarKurali: z.string().refine(isValidRule, 'geçersiz tekrar kuralı'),
  }),
  baseSchema.extend({ tur: z.literal('kosullu'), engelleyenId: z.number().int().positive() }),
  // 'turetilmis' is deliberately absent — only the materialization job creates those
]);

hatirlaticilarRouter.get('/', (req, res) => {
  const conds = [];
  if (req.query.durum) conds.push(eq(schema.hatirlaticilar.durum, String(req.query.durum) as 'bekliyor'));
  if (req.query.proje) conds.push(eq(schema.hatirlaticilar.projeId, Number(req.query.proje)));
  const base = db.select().from(schema.hatirlaticilar);
  const rows = (conds.length ? base.where(and(...conds)) : base)
    .orderBy(desc(schema.hatirlaticilar.createdAt))
    .limit(Math.min(Number(req.query.limit) || 200, 500))
    .all();
  res.json(rows);
});

hatirlaticilarRouter.post('/', (req, res) => {
  const data = parseBody(createSchema, req, res);
  if (!data) return;

  if (data.tur === 'kosullu') {
    const blocker = db.query.hatirlaticilar
      .findFirst({ where: eq(schema.hatirlaticilar.id, data.engelleyenId) })
      .sync();
    if (!blocker) {
      res.status(400).json({ error: 'blocker_not_found' });
      return;
    }
    if (blocker.durum === 'tamamlandi' || blocker.durum === 'iptal') {
      res.status(400).json({ error: 'blocker_already_closed' });
      return;
    }
  }

  const row = db
    .insert(schema.hatirlaticilar)
    .values({
      tur: data.tur,
      baslik: data.baslik,
      detay: data.detay ?? null,
      projeId: data.projeId ?? null,
      hatirlatmaZamani:
        data.tur === 'kosullu' ? null : new Date(data.hatirlatmaZamani).toISOString(),
      tekrarKurali: data.tur === 'tekrarli' ? data.tekrarKurali : null,
      engelleyenId: data.tur === 'kosullu' ? data.engelleyenId : null,
    })
    .returning()
    .get();
  res.status(201).json(row);
});

const updateSchema = baseSchema.partial().extend({
  hatirlatmaZamani: isoDateTime.nullish(),
});

hatirlaticilarRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(updateSchema, req, res);
  if (!data) return;
  const row = db
    .update(schema.hatirlaticilar)
    .set({
      ...data,
      ...(data.hatirlatmaZamani ? { hatirlatmaZamani: new Date(data.hatirlatmaZamani).toISOString() } : {}),
      ...touch,
    })
    .where(eq(schema.hatirlaticilar.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

/** Complete: closes this reminder and wakes anything it was blocking. */
hatirlaticilarRouter.post('/:id/complete', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db
    .update(schema.hatirlaticilar)
    .set({ durum: 'tamamlandi', ...touch })
    .where(eq(schema.hatirlaticilar.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  unblockDependents(id, new Date());
  res.json(row);
});

/** Snooze: push the time forward and reopen (also un-sends a 'gonderildi' one). */
const snoozeSchema = z.object({ minutes: z.number().int().min(1).max(60 * 24 * 30) });

hatirlaticilarRouter.post('/:id/snooze', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(snoozeSchema, req, res);
  if (!data) return;
  const newTime = new Date(Date.now() + data.minutes * 60_000).toISOString();
  const row = db
    .update(schema.hatirlaticilar)
    .set({ hatirlatmaZamani: newTime, durum: 'bekliyor', ...touch })
    .where(eq(schema.hatirlaticilar.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

hatirlaticilarRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  // anything this row was blocking loses its blocker (becomes a plain dateless kosullu)
  const row = db.delete(schema.hatirlaticilar).where(eq(schema.hatirlaticilar.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});
