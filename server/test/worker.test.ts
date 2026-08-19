import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { db, schema } from '../src/db/index.js';
import {
  processDueReminders,
  runDailyDigest,
  findDueReminders,
  unblockDependents,
} from '../src/worker/reminders.js';
import type { PushPayload, PushResult } from '../src/lib/push.js';

/** Fake push sender: records payloads, simulates one healthy subscription. */
function fakePush() {
  const sent: PushPayload[] = [];
  const sender = async (payload: PushPayload): Promise<PushResult[]> => {
    sent.push(payload);
    return [{ endpoint: 'https://fake/sub1', success: true }];
  };
  return { sent, deps: { sendPush: sender } };
}

function insertReminder(values: Partial<typeof schema.hatirlaticilar.$inferInsert>) {
  return db
    .insert(schema.hatirlaticilar)
    .values({ tur: 'sabit', baslik: 'test', durum: 'bekliyor', ...values } as never)
    .returning()
    .get();
}

beforeEach(() => {
  db.delete(schema.reminderDeliveries).run();
  db.delete(schema.hatirlaticilar).run();
  db.delete(schema.appState).run();
});

const NOW = new Date('2026-08-20T08:00:00Z'); // 11:00 TRT

describe('due detection', () => {
  it('finds overdue bekliyor reminders, ignores future and closed ones', () => {
    insertReminder({ baslik: 'due', hatirlatmaZamani: '2026-08-20T07:59:00Z' });
    insertReminder({ baslik: 'future', hatirlatmaZamani: '2026-08-20T09:00:00Z' });
    insertReminder({ baslik: 'done', hatirlatmaZamani: '2026-08-20T07:00:00Z', durum: 'tamamlandi' });
    insertReminder({ baslik: 'cancelled', hatirlatmaZamani: '2026-08-20T07:00:00Z', durum: 'iptal' });

    const due = findDueReminders(NOW);
    expect(due.map((r) => r.baslik)).toEqual(['due']);
  });

  it('holds a conditional reminder while its blocker is open, releases when completed', () => {
    const blocker = insertReminder({ baslik: 'kalıp söküm', hatirlatmaZamani: '2026-08-19T05:00:00Z' });
    insertReminder({
      tur: 'kosullu',
      baslik: 'demirciyi ara',
      hatirlatmaZamani: '2026-08-20T07:00:00Z', // has a time but still blocked
      engelleyenId: blocker.id,
    });

    expect(findDueReminders(NOW).map((r) => r.baslik)).toEqual(['kalıp söküm']);

    db.update(schema.hatirlaticilar)
      .set({ durum: 'tamamlandi' })
      .where(eq(schema.hatirlaticilar.id, blocker.id))
      .run();
    expect(findDueReminders(NOW).map((r) => r.baslik)).toEqual(['demirciyi ara']);
  });
});

describe('processDueReminders', () => {
  it('sends a push, records the delivery, marks sabit as gonderildi', async () => {
    const r = insertReminder({
      baslik: 'Çek vadesi yarın',
      detay: 'Ziraat — 150.000 TL',
      hatirlatmaZamani: '2026-08-20T07:00:00Z',
    });
    const { sent, deps } = fakePush();

    const count = await processDueReminders(NOW, deps);
    expect(count).toBe(1);
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('Çek vadesi yarın');
    expect(sent[0].body).toContain('Ziraat');

    const after = db.query.hatirlaticilar.findFirst({ where: eq(schema.hatirlaticilar.id, r.id) }).sync()!;
    expect(after.durum).toBe('gonderildi');

    const deliveries = db.select().from(schema.reminderDeliveries).all();
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].success).toBe(1);
    expect(deliveries[0].channel).toBe('push');
  });

  it('does NOT resend on the next tick (idempotent)', async () => {
    insertReminder({ baslik: 'once', hatirlatmaZamani: '2026-08-20T07:00:00Z' });
    const { sent, deps } = fakePush();

    await processDueReminders(NOW, deps);
    await processDueReminders(new Date(NOW.getTime() + 60_000), deps);
    expect(sent).toHaveLength(1);
  });

  it('advances a recurring reminder and keeps it bekliyor', async () => {
    const r = insertReminder({
      tur: 'tekrarli',
      baslik: 'SGK bildirgesi',
      hatirlatmaZamani: '2026-08-20T05:00:00Z',
      tekrarKurali: 'her_ay:26',
    });
    const { sent, deps } = fakePush();

    await processDueReminders(NOW, deps);
    expect(sent).toHaveLength(1);

    const after = db.query.hatirlaticilar.findFirst({ where: eq(schema.hatirlaticilar.id, r.id) }).sync()!;
    expect(after.durum).toBe('bekliyor'); // series stays alive
    expect(after.hatirlatmaZamani!.slice(0, 10)).toBe('2026-08-26');
  });

  it('catches up a recurring reminder the server slept through (no send-storm)', async () => {
    // daily at 06:00 UTC, last occurrence 5 days ago; server was down since
    const r = insertReminder({
      tur: 'tekrarli',
      baslik: 'günlük kontrol',
      hatirlatmaZamani: '2026-08-15T06:00:00Z',
      tekrarKurali: 'her_gun',
    });
    const { sent, deps } = fakePush();

    await processDueReminders(NOW, deps);
    expect(sent).toHaveLength(1); // ONE send, not five

    const after = db.query.hatirlaticilar.findFirst({ where: eq(schema.hatirlaticilar.id, r.id) }).sync()!;
    expect(after.hatirlatmaZamani).toBe('2026-08-21T06:00:00.000Z'); // strictly in the future
  });

  it('records failed deliveries with the error', async () => {
    insertReminder({ baslik: 'fail case', hatirlatmaZamani: '2026-08-20T07:00:00Z' });
    const deps = {
      sendPush: async (): Promise<PushResult[]> => [
        { endpoint: 'https://fake/dead', success: false, error: 'HTTP 410' },
      ],
    };
    await processDueReminders(NOW, deps);
    const deliveries = db.select().from(schema.reminderDeliveries).all();
    expect(deliveries[0].success).toBe(0);
    expect(deliveries[0].error).toBe('HTTP 410');
  });
});

describe('unblockDependents', () => {
  it('gives date-less conditionals a due time when their blocker completes', () => {
    const blocker = insertReminder({ baslik: 'kalıp', hatirlatmaZamani: '2026-08-19T05:00:00Z' });
    const dep = insertReminder({
      tur: 'kosullu',
      baslik: 'demirci',
      hatirlatmaZamani: null,
      engelleyenId: blocker.id,
    });

    unblockDependents(blocker.id, NOW);
    const after = db.query.hatirlaticilar.findFirst({ where: eq(schema.hatirlaticilar.id, dep.id) }).sync()!;
    expect(after.hatirlatmaZamani).toBe(NOW.toISOString());
  });
});

describe('runDailyDigest', () => {
  const MORNING = new Date('2026-08-20T04:30:00Z'); // 07:30 TRT
  const BEFORE_SEVEN = new Date('2026-08-20T03:30:00Z'); // 06:30 TRT

  it('does nothing before 07:00 TRT', async () => {
    insertReminder({ baslik: 'x', hatirlatmaZamani: '2026-08-20T05:00:00Z' });
    const { sent, deps } = fakePush();
    expect(await runDailyDigest(BEFORE_SEVEN, deps)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it("sends ONE digest listing today's items, then never again the same day", async () => {
    insertReminder({ baslik: 'çek vadesi', hatirlatmaZamani: '2026-08-20T05:00:00Z' });
    insertReminder({ baslik: 'beton kontrol', hatirlatmaZamani: '2026-08-20T13:00:00Z' });
    insertReminder({ baslik: 'gelecek hafta', hatirlatmaZamani: '2026-08-27T05:00:00Z' }); // excluded
    const { sent, deps } = fakePush();

    expect(await runDailyDigest(MORNING, deps)).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0].title).toBe('Bugün: 2 hatırlatma');
    expect(sent[0].body).toContain('çek vadesi');
    expect(sent[0].body).toContain('beton kontrol');
    expect(sent[0].body).not.toContain('gelecek hafta');

    // an hour later, same day → no second digest
    expect(await runDailyDigest(new Date('2026-08-20T05:30:00Z'), deps)).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it('skips the push entirely on an empty day (no noise)', async () => {
    const { sent, deps } = fakePush();
    expect(await runDailyDigest(MORNING, deps)).toBe(false);
    expect(sent).toHaveLength(0);
  });

  it('includes overdue items that were sent but never completed', async () => {
    insertReminder({
      baslik: 'dünden kalan',
      hatirlatmaZamani: '2026-08-19T05:00:00Z',
      durum: 'gonderildi',
    });
    const { sent, deps } = fakePush();
    await runDailyDigest(MORNING, deps);
    expect(sent[0].body).toContain('dünden kalan');
  });
});
