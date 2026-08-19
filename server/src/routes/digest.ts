import { Router } from 'express';
import { and, asc, eq, gt, isNull, lte } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { trtDateOf, utcAtTrtEndOfDay, addDays } from '../lib/time.js';

export const digestRouter = Router();

const h = schema.hatirlaticilar;

/** The data behind the "Bugün" screen and the 07:00 push. */
digestRouter.get('/today', (_req, res) => {
  const nowIso = new Date().toISOString();
  const trtToday = trtDateOf(new Date());
  const endOfToday = utcAtTrtEndOfDay(trtToday).toISOString();
  const endOfWeek = utcAtTrtEndOfDay(addDays(trtToday, 7)).toISOString();

  // already pushed but never completed — still on the plate
  const overdue = db
    .select()
    .from(h)
    .where(and(eq(h.durum, 'gonderildi'), lte(h.hatirlatmaZamani, nowIso)))
    .orderBy(asc(h.hatirlatmaZamani))
    .all();

  // due sometime today (including not-yet-fired)
  const today = db
    .select()
    .from(h)
    .where(and(eq(h.durum, 'bekliyor'), lte(h.hatirlatmaZamani, endOfToday)))
    .orderBy(asc(h.hatirlatmaZamani))
    .all();

  const upcoming = db
    .select()
    .from(h)
    .where(and(eq(h.durum, 'bekliyor'), gt(h.hatirlatmaZamani, endOfToday), lte(h.hatirlatmaZamani, endOfWeek)))
    .orderBy(asc(h.hatirlatmaZamani))
    .all();

  // conditional reminders still waiting on their blocker
  const waiting = db.select().from(h).where(and(eq(h.durum, 'bekliyor'), isNull(h.hatirlatmaZamani))).all();

  res.json({ overdue, today, upcoming, waiting });
});
