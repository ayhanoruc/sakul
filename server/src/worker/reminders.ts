// The reminder engine — SPEC §6. ONE delivery path for every reminder kind.
// Pure-ish functions taking (now, deps) so tests can inject time and a fake push sender.
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { sendPushToAll, type PushSender } from '../lib/push.js';
import { nextOccurrence } from '../lib/recurrence.js';
import { trtDateOf, utcAtTrtEndOfDay } from '../lib/time.js';

export type WorkerDeps = { sendPush: PushSender };
const realDeps: WorkerDeps = { sendPush: sendPushToAll };

const touch = { updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` };

/** A reminder is due when: bekliyor, its time has come, and its blocker (if any) is completed. */
export function findDueReminders(now: Date) {
  const rows = db
    .select()
    .from(schema.hatirlaticilar)
    .where(
      and(
        eq(schema.hatirlaticilar.durum, 'bekliyor'),
        lte(schema.hatirlaticilar.hatirlatmaZamani, now.toISOString()),
      ),
    )
    .all();
  // blocker check (self-join is clumsy in drizzle sqlite; N is tiny)
  return rows.filter((r) => {
    if (r.engelleyenId == null) return true;
    const blocker = db.query.hatirlaticilar
      .findFirst({ where: eq(schema.hatirlaticilar.id, r.engelleyenId) })
      .sync();
    return blocker?.durum === 'tamamlandi';
  });
}

async function deliver(
  reminder: typeof schema.hatirlaticilar.$inferSelect,
  deps: WorkerDeps,
): Promise<void> {
  const proje = reminder.projeId
    ? db.query.projeler.findFirst({ where: eq(schema.projeler.id, reminder.projeId) }).sync()
    : null;
  const results = await deps.sendPush({
    title: reminder.baslik,
    body: [reminder.detay, proje?.ad].filter(Boolean).join(' — ') || undefined,
    url: '/',
    tag: `hatirlatici-${reminder.id}`,
  });
  for (const r of results) {
    db.insert(schema.reminderDeliveries)
      .values({
        hatirlaticiId: reminder.id,
        channel: 'push',
        success: r.success ? 1 : 0,
        error: r.error ?? null,
      })
      .run();
  }
}

/** The 60s tick: send everything due, then advance recurring / mark the rest sent. */
export async function processDueReminders(now: Date, deps: WorkerDeps = realDeps): Promise<number> {
  const due = findDueReminders(now);
  for (const r of due) {
    await deliver(r, deps);
    if (r.tur === 'tekrarli' && r.tekrarKurali && r.hatirlatmaZamani) {
      // advance to the next occurrence; the series stays bekliyor
      let next = new Date(r.hatirlatmaZamani);
      do {
        next = nextOccurrence(r.tekrarKurali, next);
      } while (next <= now); // catch up if the server slept past occurrences
      db.update(schema.hatirlaticilar)
        .set({ hatirlatmaZamani: next.toISOString(), ...touch })
        .where(eq(schema.hatirlaticilar.id, r.id))
        .run();
    } else {
      db.update(schema.hatirlaticilar)
        .set({ durum: 'gonderildi', ...touch })
        .where(eq(schema.hatirlaticilar.id, r.id))
        .run();
    }
  }
  return due.length;
}

const DIGEST_STATE_KEY = 'last_digest_trt_date';
const DIGEST_HOUR_TRT = 7;

/** Everything on today's TRT plate: overdue + due today, still open. */
export function digestItems(now: Date) {
  const endOfToday = utcAtTrtEndOfDay(trtDateOf(now)).toISOString();
  return db
    .select()
    .from(schema.hatirlaticilar)
    .where(
      and(
        or(eq(schema.hatirlaticilar.durum, 'bekliyor'), eq(schema.hatirlaticilar.durum, 'gonderildi')),
        lte(schema.hatirlaticilar.hatirlatmaZamani, endOfToday),
      ),
    )
    .orderBy(schema.hatirlaticilar.hatirlatmaZamani)
    .all();
}

/** 07:00 TRT: ONE summary push per day. Skips empty days. */
export async function runDailyDigest(now: Date, deps: WorkerDeps = realDeps): Promise<boolean> {
  const today = trtDateOf(now);
  const trtHour = (now.getUTCHours() + 3) % 24;
  if (trtHour < DIGEST_HOUR_TRT) return false;

  const last = db.query.appState.findFirst({ where: eq(schema.appState.key, DIGEST_STATE_KEY) }).sync();
  if (last?.value === today) return false;

  const items = digestItems(now);
  if (items.length > 0) {
    const titles = items.slice(0, 4).map((i) => `• ${i.baslik}`).join('\n');
    const more = items.length > 4 ? `\n… ve ${items.length - 4} tane daha` : '';
    await deps.sendPush({
      title: `Bugün: ${items.length} hatırlatma`,
      body: titles + more,
      url: '/',
      tag: 'gunluk-ozet',
    });
  }
  db.insert(schema.appState)
    .values({ key: DIGEST_STATE_KEY, value: today })
    .onConflictDoUpdate({ target: schema.appState.key, set: { value: today } })
    .run();
  return items.length > 0;
}

/** Wire the real timers. Called once from index.ts — never from tests. */
export function startWorker() {
  const tick = async () => {
    try {
      const now = new Date();
      await processDueReminders(now);
      await runDailyDigest(now);
    } catch (err) {
      console.error('worker tick failed:', err);
    }
  };
  setInterval(tick, 60_000);
  void tick(); // run once at boot so a restart doesn't delay overdue sends
}

/** Blocker completed → date-less conditional dependents become due immediately. */
export function unblockDependents(completedId: number, now: Date) {
  db.update(schema.hatirlaticilar)
    .set({ hatirlatmaZamani: now.toISOString(), ...touch })
    .where(
      and(
        eq(schema.hatirlaticilar.engelleyenId, completedId),
        eq(schema.hatirlaticilar.durum, 'bekliyor'),
        isNull(schema.hatirlaticilar.hatirlatmaZamani),
      ),
    )
    .run();
}
