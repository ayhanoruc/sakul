// Materialization — SPEC §6. Derived ("turetilmis") reminders become ordinary rows in
// hatirlaticilar, so the tick and the digest never special-case anything.
//
// Offsets (days before the source date, reminder fires at 07:00 TRT):
//   çek vadesi        T-7, T-1, T-0     (highest stakes in the system)
//   belge expiry      T-30, T-7, T-1
//   hakediş vadesi    T-3, T-0
//   malzeme teslim    T-0
//
// Idempotency: UNIQUE(kaynak_tablo, kaynak_id, hatirlatma_zamani) + ON CONFLICT DO NOTHING.
// Lifecycle: any write to a source row calls rematerialize(source) — pending derived rows
// are wiped and rebuilt from current state; completed ones stay as history.
import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { addDays, trtDateOf, utcAtTrtHour } from './../lib/time.js';
import { formatKurus } from '../lib/money.js';

const REMINDER_HOUR_TRT = 7;

export type SourceTable = 'cekler' | 'belgeler' | 'hakedisler' | 'malzemeler';

function insertDerived(
  tablo: SourceTable,
  id: number,
  projeId: number | null,
  zamanUtc: Date,
  baslik: string,
  detay: string | null,
) {
  db.insert(schema.hatirlaticilar)
    .values({
      tur: 'turetilmis',
      baslik,
      detay,
      projeId,
      hatirlatmaZamani: zamanUtc.toISOString(),
      kaynakTablo: tablo,
      kaynakId: id,
      durum: 'bekliyor',
    })
    .onConflictDoNothing()
    .run();
}

/** Remove still-open derived rows for one source (history rows stay). */
export function cleanupDerived(tablo: SourceTable, id: number) {
  db.delete(schema.hatirlaticilar)
    .where(
      and(
        eq(schema.hatirlaticilar.tur, 'turetilmis'),
        eq(schema.hatirlaticilar.kaynakTablo, tablo),
        eq(schema.hatirlaticilar.kaynakId, id),
        inArray(schema.hatirlaticilar.durum, ['bekliyor', 'gonderildi']),
      ),
    )
    .run();
}

/** Offsets whose target day hasn't already passed in TRT (same-day still fires). */
function eligibleDates(sourceDate: string, offsets: number[], now: Date): { date: string; offset: number }[] {
  const today = trtDateOf(now);
  return offsets
    .map((offset) => ({ offset, date: addDays(sourceDate, -offset) }))
    .filter(({ date }) => date >= today);
}

function gunLabel(offset: number): string {
  return offset === 0 ? 'BUGÜN' : offset === 1 ? 'yarın' : `${offset} gün sonra`;
}

export function materializeCek(cek: typeof schema.cekler.$inferSelect, now: Date) {
  if (cek.durum !== 'beklemede') return;
  const yonLabel = cek.yon === 'verilen' ? 'verilecek' : 'tahsil edilecek';
  for (const { date, offset } of eligibleDates(cek.vadeTarihi, [7, 1, 0], now)) {
    insertDerived(
      'cekler',
      cek.id,
      cek.projeId,
      utcAtTrtHour(date, REMINDER_HOUR_TRT),
      `Çek vadesi ${gunLabel(offset)}: ${cek.karsiTaraf} — ${formatKurus(cek.tutarKurus)}`,
      [cek.banka, cek.cekNo && `çek no ${cek.cekNo}`, `vade ${cek.vadeTarihi}`, yonLabel]
        .filter(Boolean)
        .join(' · '),
    );
  }
}

const BELGE_LABEL: Record<string, string> = {
  ruhsat: 'Ruhsat',
  temel_vizesi: 'Temel vizesi',
  iskan: 'İskan',
  yapi_denetim: 'Yapı denetim',
  sgk: 'SGK',
  sigorta: 'Sigorta',
  diger: 'Belge',
};

export function materializeBelge(belge: typeof schema.belgeler.$inferSelect, now: Date) {
  if (!belge.gecerlilikBitis) return;
  for (const { date, offset } of eligibleDates(belge.gecerlilikBitis, [30, 7, 1], now)) {
    insertDerived(
      'belgeler',
      belge.id,
      belge.projeId,
      utcAtTrtHour(date, REMINDER_HOUR_TRT),
      `${BELGE_LABEL[belge.tur]} süresi doluyor (${gunLabel(offset)})`,
      [belge.aciklama, `bitiş ${belge.gecerlilikBitis}`].filter(Boolean).join(' · '),
    );
  }
}

export function materializeHakedis(h: typeof schema.hakedisler.$inferSelect, now: Date) {
  if (h.odendiMi || !h.vadeTarihi) return;
  const yonLabel = h.yon === 'gelen' ? 'tahsilat' : 'ödeme';
  for (const { date, offset } of eligibleDates(h.vadeTarihi, [3, 0], now)) {
    insertDerived(
      'hakedisler',
      h.id,
      h.projeId,
      utcAtTrtHour(date, REMINDER_HOUR_TRT),
      `Hakediş ${yonLabel} ${gunLabel(offset)}: ${formatKurus(h.tutarKurus)}`,
      [h.aciklama, `vade ${h.vadeTarihi}`].filter(Boolean).join(' · '),
    );
  }
}

export function materializeMalzeme(m: typeof schema.malzemeler.$inferSelect, now: Date) {
  if (m.teslimAlindiMi || !m.teslimTarihi) return;
  for (const { date } of eligibleDates(m.teslimTarihi, [0], now)) {
    insertDerived(
      'malzemeler',
      m.id,
      m.projeId,
      utcAtTrtHour(date, REMINDER_HOUR_TRT),
      `Malzeme teslimi BUGÜN: ${m.ad}`,
      [m.tedarikci, m.miktar != null ? `${m.miktar} ${m.birim ?? ''}`.trim() : null]
        .filter(Boolean)
        .join(' · '),
    );
  }
}

/** Wipe + rebuild the derived rows of one source from its current state. */
export function rematerialize(tablo: SourceTable, id: number, now = new Date()) {
  cleanupDerived(tablo, id);
  if (tablo === 'cekler') {
    const row = db.query.cekler.findFirst({ where: eq(schema.cekler.id, id) }).sync();
    if (row) materializeCek(row, now);
  } else if (tablo === 'belgeler') {
    const row = db.query.belgeler.findFirst({ where: eq(schema.belgeler.id, id) }).sync();
    if (row) materializeBelge(row, now);
  } else if (tablo === 'hakedisler') {
    const row = db.query.hakedisler.findFirst({ where: eq(schema.hakedisler.id, id) }).sync();
    if (row) materializeHakedis(row, now);
  } else {
    const row = db.query.malzemeler.findFirst({ where: eq(schema.malzemeler.id, id) }).sync();
    if (row) materializeMalzeme(row, now);
  }
}

/** Repair/backfill pass over everything open — cheap and fully idempotent. */
export function materializeAll(now = new Date()) {
  for (const cek of db.select().from(schema.cekler).where(eq(schema.cekler.durum, 'beklemede')).all())
    materializeCek(cek, now);
  for (const b of db.select().from(schema.belgeler).all()) materializeBelge(b, now);
  for (const h of db.select().from(schema.hakedisler).where(eq(schema.hakedisler.odendiMi, 0)).all())
    materializeHakedis(h, now);
  for (const m of db.select().from(schema.malzemeler).where(eq(schema.malzemeler.teslimAlindiMi, 0)).all())
    materializeMalzeme(m, now);
}
