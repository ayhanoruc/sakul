// Şakül data model — see SPEC.md §5.
// Naming rule: Turkish ONLY for müteahhitlik domain vocabulary (ASCII), English for structure.
import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

const isoNow = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/** Timestamps: ISO-8601 TEXT, always UTC. Rendered as Europe/Istanbul in the UI. */
const timestamps = {
  createdAt: text('created_at').notNull().default(isoNow),
  updatedAt: text('updated_at').notNull().default(isoNow),
};

// ---------------------------------------------------------------- structural

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  ...timestamps,
});

export const sessions = sqliteTable('sessions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(), // sha256 of the cookie value
  userId: integer('user_id').notNull().references(() => users.id),
  expiresAt: text('expires_at').notNull(),
  ...timestamps,
});

/** Long-lived tokens for iOS Shortcuts. Shown once, stored hashed, scoped, revocable. */
export const deviceTokens = sqliteTable('device_tokens', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  tokenHash: text('token_hash').notNull().unique(),
  userId: integer('user_id').notNull().references(() => users.id),
  name: text('name').notNull(), // "Abi iPhone"
  scopes: text('scopes').notNull().default('notes:write,reminders:write'),
  lastUsedAt: text('last_used_at'),
  revokedAt: text('revoked_at'),
  ...timestamps,
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().references(() => users.id),
  endpoint: text('endpoint').notNull().unique(),
  p256dh: text('p256dh').notNull(),
  auth: text('auth').notNull(),
  lastSeenAt: text('last_seen_at'),
  ...timestamps,
});

// -------------------------------------------------------------------- domain

export const projeler = sqliteTable('projeler', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  ad: text('ad').notNull(),
  adres: text('adres'),
  adaParsel: text('ada_parsel'),
  malSahibi: text('mal_sahibi'),
  durum: text('durum', { enum: ['aktif', 'tamamlandi', 'beklemede'] }).notNull().default('aktif'),
  baslangicTarihi: text('baslangic_tarihi'), // DATE (YYYY-MM-DD)
  aciklama: text('aciklama'),
  ...timestamps,
});

export const taseronlar = sqliteTable('taseronlar', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projeId: integer('proje_id').references(() => projeler.id),
  ad: text('ad').notNull(),
  isKolu: text('is_kolu'), // kalipci, demirci, sivaci, elektrikci, boyaci...
  telefon: text('telefon'),
  anlasilanTutarKurus: integer('anlasilan_tutar_kurus'), // money = INTEGER kurus, never floats
  aciklama: text('aciklama'),
  ...timestamps,
});

/** Text only, by design — voice arrives as text via iOS dictation. SPEC §7. */
export const notlar = sqliteTable(
  'notlar',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projeId: integer('proje_id').references(() => projeler.id), // nullable: capture first, attach later
    icerik: text('icerik').notNull(),
    kaynak: text('kaynak', { enum: ['pwa', 'shortcut', 'telegram'] }).notNull().default('pwa'),
    ...timestamps,
  },
  (t) => [index('notlar_proje_idx').on(t.projeId)],
);

/** The knowledge base: files on disk, metadata here. Private — served only via the auth-gated API. */
export const dosyalar = sqliteTable(
  'dosyalar',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projeId: integer('proje_id').references(() => projeler.id),
    orijinalAd: text('orijinal_ad').notNull(),
    saklananYol: text('saklanan_yol').notNull().unique(), // relative: YYYY/MM/uuid.ext
    mime: text('mime').notNull(),
    boyutByte: integer('boyut_byte').notNull(),
    sha256: text('sha256').notNull(), // dedupe + integrity
    kategori: text('kategori', {
      enum: ['sozlesme', 'ruhsat', 'cek_goruntu', 'fatura', 'foto', 'diger'],
    }).notNull().default('diger'),
    aciklama: text('aciklama'),
    etiketler: text('etiketler'), // comma-separated in v1 — a join table is ceremony at this scale
    ...timestamps,
  },
  (t) => [index('dosyalar_proje_idx').on(t.projeId), index('dosyalar_kategori_idx').on(t.kategori)],
);

/** Progress payments, both directions. yon: gelen = from mal sahibi, giden = to taseron. */
export const hakedisler = sqliteTable(
  'hakedisler',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projeId: integer('proje_id').notNull().references(() => projeler.id),
    taseronId: integer('taseron_id').references(() => taseronlar.id),
    yon: text('yon', { enum: ['gelen', 'giden'] }).notNull(),
    aciklama: text('aciklama'),
    tutarKurus: integer('tutar_kurus').notNull(),
    vadeTarihi: text('vade_tarihi'), // DATE
    odendiMi: integer('odendi_mi').notNull().default(0),
    odemeTarihi: text('odeme_tarihi'),
    ...timestamps,
  },
  (t) => [index('hakedisler_proje_idx').on(t.projeId)],
);

/** Post-dated cheques — the highest-stakes rows in the system. */
export const cekler = sqliteTable(
  'cekler',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projeId: integer('proje_id').references(() => projeler.id),
    yon: text('yon', { enum: ['verilen', 'alinan'] }).notNull(),
    karsiTaraf: text('karsi_taraf').notNull(),
    tutarKurus: integer('tutar_kurus').notNull(),
    vadeTarihi: text('vade_tarihi').notNull(), // DATE — drives derived reminders
    banka: text('banka'),
    cekNo: text('cek_no'),
    durum: text('durum', { enum: ['beklemede', 'odendi', 'karsiliksiz', 'iptal'] })
      .notNull()
      .default('beklemede'),
    dosyaId: integer('dosya_id').references(() => dosyalar.id), // photo of the cek
    ...timestamps,
  },
  (t) => [index('cekler_vade_idx').on(t.vadeTarihi)],
);

/** Official documents whose expiry drives derived reminders. */
export const belgeler = sqliteTable(
  'belgeler',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projeId: integer('proje_id').notNull().references(() => projeler.id),
    tur: text('tur', {
      enum: ['ruhsat', 'temel_vizesi', 'iskan', 'yapi_denetim', 'sgk', 'sigorta', 'diger'],
    }).notNull(),
    verilisTarihi: text('verilis_tarihi'), // DATE
    gecerlilikBitis: text('gecerlilik_bitis'), // DATE, nullable — drives derived reminders
    dosyaId: integer('dosya_id').references(() => dosyalar.id),
    aciklama: text('aciklama'),
    ...timestamps,
  },
  (t) => [index('belgeler_proje_idx').on(t.projeId)],
);

export const malzemeler = sqliteTable(
  'malzemeler',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    projeId: integer('proje_id').notNull().references(() => projeler.id),
    ad: text('ad').notNull(),
    tedarikci: text('tedarikci'),
    miktar: real('miktar'),
    birim: text('birim'), // m3, ton, adet...
    siparisTarihi: text('siparis_tarihi'), // DATE
    teslimTarihi: text('teslim_tarihi'), // DATE — drives derived reminder at T-0
    teslimAlindiMi: integer('teslim_alindi_mi').notNull().default(0),
    ...timestamps,
  },
  (t) => [index('malzemeler_proje_idx').on(t.projeId)],
);

/**
 * ONE table for all four reminder kinds — the kind is data, not code. SPEC §6.
 *  sabit:      hatirlatmaZamani set, fires once
 *  tekrarli:   tekrarKurali set (her_gun | her_hafta:pzt | her_ay:26), zamani advances after send
 *  turetilmis: materialized from cekler/belgeler/hakedisler/malzemeler (kaynakTablo+kaynakId)
 *  kosullu:    engelleyenId set, no date — becomes due when the blocker completes
 */
export const hatirlaticilar = sqliteTable(
  'hatirlaticilar',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    tur: text('tur', { enum: ['sabit', 'tekrarli', 'turetilmis', 'kosullu'] }).notNull(),
    baslik: text('baslik').notNull(),
    detay: text('detay'),
    projeId: integer('proje_id').references(() => projeler.id),
    hatirlatmaZamani: text('hatirlatma_zamani'), // ISO UTC; NULL only for kosullu
    tekrarKurali: text('tekrar_kurali'),
    engelleyenId: integer('engelleyen_id'), // self-reference; FK added in raw migration
    kaynakTablo: text('kaynak_tablo'),
    kaynakId: integer('kaynak_id'),
    durum: text('durum', { enum: ['bekliyor', 'gonderildi', 'tamamlandi', 'iptal'] })
      .notNull()
      .default('bekliyor'),
    ...timestamps,
  },
  (t) => [
    index('hatirlaticilar_due_idx').on(t.durum, t.hatirlatmaZamani),
    // makes nightly materialization idempotent
    uniqueIndex('hatirlaticilar_kaynak_uniq').on(t.kaynakTablo, t.kaynakId, t.hatirlatmaZamani),
  ],
);

/** Audit: what was sent, when, on which channel, did it land. */
export const reminderDeliveries = sqliteTable('reminder_deliveries', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  hatirlaticiId: integer('hatirlatici_id').notNull().references(() => hatirlaticilar.id),
  sentAt: text('sent_at').notNull().default(isoNow),
  channel: text('channel', { enum: ['push', 'telegram'] }).notNull(),
  success: integer('success').notNull(),
  error: text('error'),
});
