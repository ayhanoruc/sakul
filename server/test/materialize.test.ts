import { describe, it, expect, beforeEach } from 'vitest';
import { and, eq } from 'drizzle-orm';
import { db, schema } from '../src/db/index.js';
import { materializeAll, rematerialize, cleanupDerived } from '../src/worker/materialize.js';
import { findDueReminders } from '../src/worker/reminders.js';
import { addDays, trtDateOf } from '../src/lib/time.js';

const NOW = new Date('2026-08-20T08:00:00Z'); // 11:00 TRT, TRT date 2026-08-20
const TODAY = trtDateOf(NOW); // '2026-08-20'

function derivedFor(tablo: string, id: number) {
  return db
    .select()
    .from(schema.hatirlaticilar)
    .where(
      and(eq(schema.hatirlaticilar.kaynakTablo, tablo), eq(schema.hatirlaticilar.kaynakId, id)),
    )
    .all();
}

let projeId: number;

beforeEach(() => {
  db.delete(schema.reminderDeliveries).run();
  db.delete(schema.hatirlaticilar).run();
  db.delete(schema.cekler).run();
  db.delete(schema.belgeler).run();
  db.delete(schema.hakedisler).run();
  db.delete(schema.malzemeler).run();
  db.delete(schema.projeler).run();
  projeId = db.insert(schema.projeler).values({ ad: 'Materialize Test' }).returning().get().id;
});

function insertCek(over: Partial<typeof schema.cekler.$inferInsert> = {}) {
  return db
    .insert(schema.cekler)
    .values({
      yon: 'verilen',
      karsiTaraf: 'Mehmet Yıldız',
      tutarKurus: 15_000_000, // ₺150.000,00
      vadeTarihi: addDays(TODAY, 10),
      banka: 'Ziraat',
      projeId,
      ...over,
    })
    .returning()
    .get();
}

describe('çek materialization (T-7, T-1, T-0 @ 07:00 TRT)', () => {
  it('creates all three warnings for a çek 10 days out', () => {
    const cek = insertCek();
    rematerialize('cekler', cek.id, NOW);

    const rows = derivedFor('cekler', cek.id);
    expect(rows).toHaveLength(3);
    const dates = rows.map((r) => trtDateOf(new Date(r.hatirlatmaZamani!))).sort();
    expect(dates).toEqual([addDays(TODAY, 3), addDays(TODAY, 9), addDays(TODAY, 10)]);
    // all at 07:00 TRT = 04:00 UTC
    expect(rows.every((r) => r.hatirlatmaZamani!.endsWith('T04:00:00.000Z'))).toBe(true);
    expect(rows.every((r) => r.tur === 'turetilmis')).toBe(true);
    expect(rows[0].baslik).toContain('₺150.000,00');
    expect(rows[0].baslik).toContain('Mehmet Yıldız');
  });

  it('skips offsets whose day already passed, keeps same-day (vade tomorrow → T-1 today + T-0)', () => {
    const cek = insertCek({ vadeTarihi: addDays(TODAY, 1) });
    rematerialize('cekler', cek.id, NOW);
    const dates = derivedFor('cekler', cek.id).map((r) => trtDateOf(new Date(r.hatirlatmaZamani!))).sort();
    expect(dates).toEqual([TODAY, addDays(TODAY, 1)]); // T-7 gone; T-1 fires today (even past 07:00), T-0 tomorrow
  });

  it('same-day materialization is immediately picked up by the tick', () => {
    const cek = insertCek({ vadeTarihi: TODAY }); // vade BUGÜN, entered at 11:00
    rematerialize('cekler', cek.id, NOW);
    const rows = derivedFor('cekler', cek.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].baslik).toContain('BUGÜN');
    // 07:00 TRT already passed → due right now
    expect(findDueReminders(NOW).map((r) => r.id)).toContain(rows[0].id);
  });

  it('is idempotent — rematerializing N times yields the same rows', () => {
    const cek = insertCek();
    rematerialize('cekler', cek.id, NOW);
    rematerialize('cekler', cek.id, NOW);
    materializeAll(NOW);
    expect(derivedFor('cekler', cek.id)).toHaveLength(3);
  });

  it('marking a çek odendi wipes its pending warnings', () => {
    const cek = insertCek();
    rematerialize('cekler', cek.id, NOW);
    expect(derivedFor('cekler', cek.id)).toHaveLength(3);

    db.update(schema.cekler).set({ durum: 'odendi' }).where(eq(schema.cekler.id, cek.id)).run();
    rematerialize('cekler', cek.id, NOW);
    expect(derivedFor('cekler', cek.id)).toHaveLength(0);
  });

  it('a vade change moves the warnings', () => {
    const cek = insertCek();
    rematerialize('cekler', cek.id, NOW);

    db.update(schema.cekler).set({ vadeTarihi: addDays(TODAY, 20) }).where(eq(schema.cekler.id, cek.id)).run();
    rematerialize('cekler', cek.id, NOW);

    const dates = derivedFor('cekler', cek.id).map((r) => trtDateOf(new Date(r.hatirlatmaZamani!))).sort();
    expect(dates).toEqual([addDays(TODAY, 13), addDays(TODAY, 19), addDays(TODAY, 20)]);
  });

  it('keeps already-delivered warnings as history when cleaning up', () => {
    const cek = insertCek();
    rematerialize('cekler', cek.id, NOW);
    const one = derivedFor('cekler', cek.id)[0];
    db.update(schema.hatirlaticilar).set({ durum: 'tamamlandi' }).where(eq(schema.hatirlaticilar.id, one.id)).run();

    cleanupDerived('cekler', cek.id);
    const left = derivedFor('cekler', cek.id);
    expect(left).toHaveLength(1);
    expect(left[0].durum).toBe('tamamlandi');
  });
});

describe('belge materialization (T-30, T-7, T-1)', () => {
  it('creates warnings only when an expiry exists', () => {
    const noExpiry = db
      .insert(schema.belgeler)
      .values({ projeId, tur: 'ruhsat' })
      .returning()
      .get();
    rematerialize('belgeler', noExpiry.id, NOW);
    expect(derivedFor('belgeler', noExpiry.id)).toHaveLength(0);

    const withExpiry = db
      .insert(schema.belgeler)
      .values({ projeId, tur: 'sigorta', gecerlilikBitis: addDays(TODAY, 40) })
      .returning()
      .get();
    rematerialize('belgeler', withExpiry.id, NOW);
    const rows = derivedFor('belgeler', withExpiry.id);
    expect(rows).toHaveLength(3);
    expect(rows[0].baslik).toContain('Sigorta');
  });
});

describe('hakediş materialization (T-3, T-0)', () => {
  it('creates warnings for unpaid hakediş with a vade', () => {
    const h = db
      .insert(schema.hakedisler)
      .values({ projeId, yon: 'giden', tutarKurus: 5_000_000, vadeTarihi: addDays(TODAY, 5) })
      .returning()
      .get();
    rematerialize('hakedisler', h.id, NOW);
    const rows = derivedFor('hakedisler', h.id);
    expect(rows).toHaveLength(2);
    expect(rows[0].baslik).toContain('ödeme'); // giden → ödeme
    expect(rows[0].baslik).toContain('₺50.000,00');
  });

  it('paying it clears pending warnings', () => {
    const h = db
      .insert(schema.hakedisler)
      .values({ projeId, yon: 'gelen', tutarKurus: 1000, vadeTarihi: addDays(TODAY, 5) })
      .returning()
      .get();
    rematerialize('hakedisler', h.id, NOW);
    expect(derivedFor('hakedisler', h.id)).toHaveLength(2);

    db.update(schema.hakedisler).set({ odendiMi: 1 }).where(eq(schema.hakedisler.id, h.id)).run();
    rematerialize('hakedisler', h.id, NOW);
    expect(derivedFor('hakedisler', h.id)).toHaveLength(0);
  });
});

describe('malzeme materialization (T-0)', () => {
  it('reminds on delivery day, disappears when received', () => {
    const m = db
      .insert(schema.malzemeler)
      .values({ projeId, ad: 'C30 beton', tedarikci: 'Beton A.Ş.', miktar: 45, birim: 'm3', teslimTarihi: addDays(TODAY, 2) })
      .returning()
      .get();
    rematerialize('malzemeler', m.id, NOW);
    const rows = derivedFor('malzemeler', m.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].baslik).toContain('C30 beton');
    expect(rows[0].detay).toContain('45 m3');

    db.update(schema.malzemeler).set({ teslimAlindiMi: 1 }).where(eq(schema.malzemeler.id, m.id)).run();
    rematerialize('malzemeler', m.id, NOW);
    expect(derivedFor('malzemeler', m.id)).toHaveLength(0);
  });
});

describe('materializeAll (repair pass)', () => {
  it('covers every open source and skips closed ones', () => {
    const open = insertCek();
    const paid = insertCek({ durum: 'odendi', karsiTaraf: 'Ödenmiş Çek' });
    db.insert(schema.belgeler).values({ projeId, tur: 'ruhsat', gecerlilikBitis: addDays(TODAY, 15) }).run();
    db.insert(schema.hakedisler).values({ projeId, yon: 'gelen', tutarKurus: 100, vadeTarihi: addDays(TODAY, 2), odendiMi: 1 }).run();

    materializeAll(NOW);

    expect(derivedFor('cekler', open.id).length).toBeGreaterThan(0);
    expect(derivedFor('cekler', paid.id)).toHaveLength(0);
    const all = db.select().from(schema.hatirlaticilar).all();
    // open çek (3) + belge (2: T-7 and T-1 within 15 days? no — T-30 skipped, T-7, T-1) = 3+2
    expect(all.filter((r) => r.kaynakTablo === 'belgeler')).toHaveLength(2);
    expect(all.filter((r) => r.kaynakTablo === 'hakedisler')).toHaveLength(0);
  });
});
