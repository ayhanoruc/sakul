# Şakül — Project Specification & Build Plan

> **Şakül** (plumb bob): a weight on a string that gives you a true vertical.
> This app is the plumb bob for a small construction contracting (müteahitlik) business —
> it keeps the operation straight: what to remember, what was said, what was signed, what is due.

**Repo:** https://github.com/ayhanoruc/sakul (GitHub strips non-ASCII; the product name stays Şakül, the slug is `sakul`)
**Spec status:** agreed 2026-08-20. This document is the source of truth; update it when decisions change.

---

## 1. What this is

A private, self-hosted tool for the owner's brother (and later uncle), who run a müteahitlik
business together. The system on paper already works; the problem is volume: reminders,
documents, payments, post-dated çeks, and daily events that must be captured and found later.

**Core features (in build order):**

1. **Hatırlatıcılar** — reminders of four kinds (fixed date, recurring, document-expiry-derived, conditional), delivered as iOS push notifications + a 07:00 morning digest ("bugün hatırlaman gerekenler").
2. **Notlar** — fast text notes; voice becomes text via iOS dictation (see §7). Text-only by design.
3. **Kayıt / log** — structured records: projects, taşerons, hakedişler, çeks, materials.
4. **Depo (knowledge base)** — file storage (contracts, ruhsats, photos, PDFs) with rich metadata, searchable by human and — later — by AI.
5. **AI layer (future, Stage 6)** — chat over the knowledge base, smart reminder proposals from notes. Explicitly **not** in v1; the schema is built so it can land on top without migration.

**Non-goals for v1:** multi-user roles, audio recording/STT, NLP date parsing, offline-first
sync, native app, App Store anything.

---

## 2. Users & constraints

| Constraint | Consequence |
|---|---|
| Single user: **abi** (uncle later = one INSERT, not a migration) | Session auth, no roles/permissions matrix |
| iPhone, **no App Store** | PWA installed via Safari "Ana Ekrana Ekle" |
| Push must work | iOS ≥ 16.4, HTTPS mandatory, permission requested from a user tap, **only works when installed to Home Screen** |
| Quick actions / "widgets" | iOS **Shortcuts** (Home Screen icons, Siri, Action Button) — not WidgetKit, which is impossible for web |
| Self-hosted | Existing Hetzner CX23 (2 vCPU / 4 GB / 40 GB, Nuremberg) already running yildiz360 |
| Users are in Turkey, server in Germany | **All timestamps stored UTC**, rendered `Europe/Istanbul` (UTC+3, no DST). Digest fires 07:00 TRT = 04:00 UTC |
| Owner reads the code | **Naming rule:** Turkish ONLY for business-domain terms with no clean English equivalent (`hakedisler`, `taseronlar`, `cekler`, `belgeler`, `notlar`, `projeler`, `hatirlaticilar`, `vade_tarihi`, `tutar_kurus`...), always ASCII-only. EVERYTHING structural is English: endpoints like `/api/health`, `/api/auth/login`, `/api/search`; fields like `status`, `version`, `id`, `created_at`; all variables, functions, types. UI copy (user-facing strings) is Turkish. |

---

## 3. Technology decisions (with the reasons, so they can be re-evaluated)

| Layer | Choice | Reason |
|---|---|---|
| Backend | **Node 20 + Express 4 + TypeScript**, port **3002** | Same runtime already on the box; 3001 is taken by yildiz360 |
| DB | **SQLite via `better-sqlite3`** + **Drizzle ORM** | 1–2 users; single-file backup fits existing cron pattern; Drizzle keeps a Postgres escape hatch. NOT `sql.js` (yildiz360's WASM build holds the DB in RAM — don't copy) |
| Search | **SQLite FTS5, `trigram` tokenizer** | Turkish agglutination defeats word tokenizers (`beton` must match `betonun/betona/betondan`); no good Turkish stemmer exists in SQLite. Cost: 3-char minimum query |
| Frontend | **Vite + React + TypeScript + Tailwind**, SPA | Login-gated tool for 1–2 people: no SEO, no SSR benefit. Static bundle served by nginx |
| PWA | Web app manifest + **Serwist** service worker | Installability now; push handler in Stage 2; offline shell in Stage 5 |
| Push | **`web-push` (VAPID)** | The iOS 16.4 web push path. No Firebase, no Apple developer account |
| Scheduler | In-process timers inside the API (60s reminder tick, nightly jobs) | A separate worker process buys isolation we don't need; splitting later is a 20-line change |
| Files | Disk under `server/uploads/YYYY/MM/`, metadata in DB, **served through Express behind auth** | These are contracts and çeks — NOT nginx-public like yildiz360's `/uploads/`. Upgrade path: `X-Accel-Redirect` |
| Deploy | **nginx vhost + PM2 + bare-git push-to-deploy** on the existing box | Mirrors the proven yildiz360 pipeline; no Docker (nothing to gain at this scale) |
| Domain | **`sakulproject.duckdns.org`** → same IP, certbot cert | Free, removes the domain prerequisite entirely |
| Python | Allowed as a sidecar for future tasks (OCR, PDF parsing) if one earns it | Not in the critical path |
| AI (future) | `claude-opus-5` chat; `claude-haiku-4-5` background jobs | Stage 6 only |

**Money is INTEGER kuruş. Never floats.** Dates/times are ISO-8601 TEXT in UTC.
Enums are TEXT + CHECK constraints.

---

## 4. Architecture

```
                        Internet :443
                              │
                    nginx (existing, shared)
              ┌───────────────┴────────────────┐
   yildiz360.duckdns.org              sakulproject.duckdns.org
              │                                │
        (untouched)         ┌─────────────────┼──────────────────┐
                            │                 │                  │
                       /  → web/dist    /api/* → :3002     /api/dosyalar/:id/download
                       static, nginx    sakul-api (PM2)    files via Express (auth),
                                            │              NOT nginx-public
                                   ┌────────┴────────┐
                                   │ Express API      │
                                   │ + 60s reminder   │
                                   │   tick           │
                                   │ + nightly jobs   │
                                   └────────┬────────┘
                                     SQLite (sakul.db)
                                     uploads/YYYY/MM/
```

**Server layout** (mirrors yildiz360's conventions):

```
/var/www/sakul.git/            # bare repo, push target, post-receive hook
/var/www/sakul/app/            # checkout
    server/   → PM2 "sakul-api", port 3002, runs compiled dist/
    web/dist/ → nginx serves
    data/     → sakul.db (OUTSIDE the checkout tree? No — see note)
```

> **DB + uploads live outside the git checkout** at `/var/www/sakul/data/` so a
> re-checkout can never clobber them. Local dev uses `server/data/` (gitignored).

**Repo layout:**

```
sakul/
├── SPEC.md               ← this file
├── DEPLOYMENT.md         ← server runbook (written in Stage 0; secrets NOT committed)
├── server/               ← Express + TS API (independent package)
│   ├── src/
│   │   ├── index.ts          # bootstrap: http server + timers
│   │   ├── app.ts            # express app (testable without listening)
│   │   ├── db/               # drizzle schema, migrations, FTS triggers
│   │   ├── routes/           # one file per resource
│   │   ├── middleware/       # auth (session + device token)
│   │   ├── worker/           # reminder tick, digest, materialization
│   │   └── lib/              # time (TRT↔UTC), money, push
│   └── data/                 # local dev DB + uploads (gitignored)
├── web/                  ← Vite + React PWA (independent package)
│   └── src/
└── shortcuts/            ← action-by-action recipes for the 3 iOS Shortcuts (docs)
```

---

## 5. Data model

Conventions: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `created_at`/`updated_at` TEXT UTC on
every table. `*_kurus` INTEGER. `proje_id` is **nullable almost everywhere** — capture first,
attach later; forcing a project at creation time kills adoption.

### Core

**`users`** — one row for now
- `username` TEXT UNIQUE, `password_hash` TEXT (bcrypt), `display_name` TEXT

**`sessions`** — hand-rolled sessions (no express-session dependency)
- `token_hash` TEXT UNIQUE (sha256 of the cookie value), `user_id` FK, `expires_at`

**`device_tokens`** — long-lived device tokens for iOS Shortcuts
- `token_hash` TEXT UNIQUE, `name` TEXT ("Abi iPhone"), `scopes` TEXT (v1: `notes:write,reminders:write`),
  `last_used_at`, `revoked_at` — lost phone = revoke one row

**`projeler`**
- `ad`, `adres`, `ada_parsel`, `mal_sahibi`, `durum` CHECK(`aktif|tamamlandi|beklemede`), `baslangic_tarihi`, `notlar_metni`

**`taseronlar`**
- `proje_id` FK NULL, `ad`, `is_kolu` (kalıpçı/demirci/sıvacı/...), `telefon`, `anlasilan_tutar_kurus` NULL

**`notlar`** — text only, by design (§7)
- `proje_id` FK NULL, `icerik` TEXT NOT NULL, `kaynak` CHECK(`pwa|shortcut|telegram`) — where it came from

**`dosyalar`** — the knowledge base
- `proje_id` FK NULL, `orijinal_ad`, `saklanan_yol` (relative `YYYY/MM/uuid.ext`), `mime`,
  `boyut_byte`, `sha256` (dedupe + integrity), `kategori` CHECK(`sozlesme|ruhsat|cek_goruntu|fatura|foto|diger`),
  `aciklama` TEXT, `etiketler` TEXT (comma-separated in v1 — a join table is ceremony at this scale)

### Money & documents

**`hakedisler`** — progress payments, both directions
- `proje_id` FK, `taseron_id` FK NULL, `yon` CHECK(`gelen|giden`) (gelen = from mal sahibi),
  `aciklama`, `tutar_kurus`, `vade_tarihi` DATE, `odendi_mi` INT 0/1, `odeme_tarihi` NULL

**`cekler`** — post-dated cheques; the highest-stakes rows in the system
- `proje_id` FK NULL, `yon` CHECK(`verilen|alinan`), `karsi_taraf` TEXT, `tutar_kurus`,
  `vade_tarihi` DATE, `banka`, `cek_no`, `durum` CHECK(`beklemede|odendi|karsiliksiz|iptal`),
  `dosya_id` FK NULL (photo of the çek)

**`belgeler`** — official documents whose expiry drives reminders
- `proje_id` FK, `tur` CHECK(`ruhsat|temel_vizesi|iskan|yapi_denetim|sgk|sigorta|diger`),
  `verilis_tarihi`, `gecerlilik_bitis` DATE NULL, `dosya_id` FK NULL, `aciklama`

**`malzemeler`** — orders & deliveries
- `proje_id` FK, `ad`, `tedarikci`, `miktar` REAL, `birim`, `siparis_tarihi`,
  `teslim_tarihi` DATE NULL, `teslim_alindi_mi` INT 0/1

### Reminders — ONE table for all four types; the type is data, not code

**`hatirlaticilar`**
- `tur` CHECK(`sabit|tekrarli|turetilmis|kosullu`)
- `baslik` TEXT NOT NULL, `detay` TEXT
- `proje_id` FK NULL
- `hatirlatma_zamani` TEXT UTC NULL — NULL only for `kosullu`
- `tekrar_kurali` TEXT NULL — mini-format, not cron: `her_gun` | `her_hafta:pzt` | `her_ay:26`
- `engelleyen_id` FK → self, NULL — "kalıp bitince demirciyi ara": no date, surfaces when blocker completes
- `kaynak_tablo` TEXT NULL + `kaynak_id` INT NULL — for `turetilmis` rows (which belge/çek generated it)
- `durum` CHECK(`bekliyor|gonderildi|tamamlandi|iptal`)
- UNIQUE(`kaynak_tablo`,`kaynak_id`,`hatirlatma_zamani`) — makes materialization idempotent

**`push_subscriptions`** — one row per installed iPhone
- `endpoint` TEXT UNIQUE, `p256dh`, `auth`, `user_id` FK, `last_seen_at`

**`reminder_deliveries`** — audit: what was sent, when, did it land
- `hatirlatici_id` FK, `sent_at`, `channel` CHECK(`push|telegram`), `success` INT, `error` TEXT NULL

### Search

**`search_fts`** — FTS5 virtual table, `tokenize='trigram'`, contentless-delete mode, indexing:
`notlar.icerik`, `dosyalar.orijinal_ad + aciklama + etiketler`, `projeler.ad`, kept in sync by
AFTER INSERT/UPDATE/DELETE triggers. One ranked query surface: notes, files, projects.

---

## 6. The reminder engine

**One delivery path.** Derived reminders are materialized into ordinary `hatirlaticilar` rows;
the sender never special-cases anything.

```
every 60s (in-process)
  SELECT FROM hatirlaticilar
   WHERE durum='bekliyor'
     AND hatirlatma_zamani <= now()
     AND (engelleyen_id IS NULL OR blocker.durum='tamamlandi')
  → web-push to every subscription
  → INSERT hatirlatici_gonderimler
  → tur='tekrarli' ? advance hatirlatma_zamani to next occurrence (durum stays 'bekliyor')
                   : durum='gonderildi'

daily 07:00 TRT (04:00 UTC)
  → everything due today + overdue-and-unfinished
  → ONE digest push: "Bugün: 3 hatırlatma, 1 çek vadesi"

nightly 02:00 TRT — materialization
  belgeler.gecerlilik_bitis → rows at T-30, T-7, T-1   (at 07:00 TRT of that day)
  cekler.vade_tarihi (durum='beklemede') → rows at T-7, T-1, T-0
  hakedisler.vade_tarihi (odendi_mi=0)  → rows at T-3, T-0
  malzemeler.teslim_tarihi (teslim_alindi_mi=0) → row at T-0
  idempotent via the UNIQUE constraint; edits/deletes of the source clean up their derived rows
```

Completing a reminder that others depend on (`engelleyen_id`) makes the dependents due.
Snooze (`ertele`) = set a new `hatirlatma_zamani`, `durum` back to `bekliyor`.

**Push realities (iOS):** permission prompt must come from a tap; notifications only arrive if
the PWA was added to Home Screen; a pruned subscription (HTTP 404/410 from the push service)
is deleted. Because iOS push can silently die if the icon is removed, **Telegram is an optional
second channel** (Stage 5): same sender loop, one more `kanal`.

---

## 7. Capture paths (voice = dictation, text-only — decided emphatically)

There is **no audio recording, no STT service, no transcript pipeline**. Voice is a *speed*
feature: iOS dictation produces text on-device; the API only ever receives text.

1. **PWA** — normal text input in the app (Safari keyboard's mic button gives dictation for free).
2. **iOS Shortcut "Şakül Not"** — Dictate Text (Turkish) → `POST /api/notlar` with a device
   token. Hands-free via "Hey Siri, Şakül not", Home Screen icon, Action Button, Back Tap.
3. **Shortcut "Şakül Hatırlat"** — Dictate title → native date picker → `POST /api/hatirlaticilar`.
4. **Shortcut "Şakül Bugün"** — opens the digest view.

**Distribution = product, not sideloading:** shortcuts ship as **iCloud links** on a `/kurulum`
page in the PWA. Install flow for abi (one sentence: *"Bu linki aç, sırayla düğmelere bas"*):

1. Ana Ekrana Ekle (required for push anyway)
2. Bildirimlere izin ver (one tap)
3. Tap each shortcut link → **Import Questions** prompt asks for the device token → paste the
   token shown on `/kurulum` (generated + revocable in the app) → done

Shortcuts are authored once by hand on an iPhone from the recipes in `shortcuts/` and stay
**thin** (dictate → one HTTP POST): all real logic lives server-side where `git push` updates it.
An iCloud link is a snapshot — logic changes server-side don't require re-install; changed
shortcut structure does (re-tap the link).

---

## 8. API surface (all JSON under `/api`, session cookie OR `Authorization: Bearer <device-token>`)

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` |
| Device tokens | `GET/POST /device-tokens`, `POST /device-tokens/:id/revoke` |
| Projects | `GET/POST /projeler`, `GET/PUT/DELETE /projeler/:id` |
| Notes | `GET/POST /notlar`, `PUT/DELETE /notlar/:id` (POST accepts device token) |
| Files | `POST /dosyalar` (multipart), `GET /dosyalar` (filters: proje, kategori, q), `PUT /dosyalar/:id` (metadata), `GET /dosyalar/:id/download` (streams, auth-gated), `DELETE` |
| Reminders | `GET/POST /hatirlaticilar`, `PUT /hatirlaticilar/:id`, `POST /:id/complete`, `POST /:id/snooze`, `DELETE` (POST accepts device token) |
| Çeks | `GET/POST /cekler`, `PUT /cekler/:id` (incl. durum transitions) |
| Hakediş | `GET/POST /hakedisler`, `PUT /hakedisler/:id` |
| Documents | `GET/POST /belgeler`, `PUT /belgeler/:id` |
| Materials | `GET/POST /malzemeler`, `PUT /malzemeler/:id` |
| Taşerons | `GET/POST /taseronlar`, `PUT /taseronlar/:id` |
| Search | `GET /search?q=` (min 3 chars, ranked, cross-entity) |
| Push | `POST /push/subscribe`, `DELETE /push/subscribe`, `GET /push/vapid-key` |
| Digest | `GET /digest/today` (the data behind the 07:00 push + "Bugün" screen) |

Validation with `zod` on every write. Device tokens are scope-limited (v1: create notes +
reminders only — a stolen token can't read the knowledge base).

---

## 9. Security

- HTTPS only (certbot), HSTS via nginx
- Session cookie: `httpOnly`, `Secure`, `SameSite=Lax`; token stored **hashed** (sha256) server-side; 30-day sliding expiry
- bcrypt for the password; login rate-limited (5/min/IP)
- Device tokens: 32 random bytes, shown once, stored hashed, scoped, revocable
- Uploads: size cap 25 MB, extension+MIME allowlist, stored under generated UUID names (no user-controlled paths), served only through the auth-gated endpoint
- Secrets live in `/var/www/sakul/shared/.env`, symlinked into the checkout — **never in git** (lesson learned from yildiz360's committed `DEPLOYMENT.md` token)
- SQLite `PRAGMA journal_mode=WAL`, `foreign_keys=ON`
- Nightly DB backup by cron (same-disk copy is NOT a real backup — enabling Hetzner Backups is on the ops list)

---

## 10. Build stages

Each stage ends **deployed and demoable on the phone**. Nothing waits for a "big launch".

### Stage 0 — Walking skeleton, live on the phone ⬅ START HERE
Monorepo scaffold (`server/` Express+TS hello API with health endpoint; `web/` Vite+React PWA
shell with manifest + minimal SW, installable). Server provisioning: `sakulproject.duckdns.org` DNS,
nginx vhost, certbot cert, PM2 `sakul-api`, bare-repo + post-receive hook, `.env` layout,
backup cron. **Exit criterion:** abi opens `https://sakulproject.duckdns.org`, adds it to Home Screen,
sees the app shell. Deploy is `git push production main`.

### Stage 1 — Auth + capture core
Full Drizzle schema + migrations for ALL tables (schema lands once, complete — features arrive
in later stages but never a schema rewrite). Login/session, `projeler`, `notlar`, `dosyalar`
upload with metadata + auth-gated download. UI: login, project list/detail, notes list + quick
add, file upload + list. **Exit criterion:** abi writes a note and uploads a contract from his
phone.

### Stage 2 — Reminders + push (the riskiest tech, so it comes early)
`push_subscriptions`, VAPID keys, permission flow in the PWA, SW push handler. `hatirlaticilar`
CRUD for `sabit|tekrarli|kosullu`, the 60s tick, complete/snooze, 07:00 TRT digest,
`reminder_deliveries` audit. **Exit criterion:** a reminder created on the phone arrives as
a push notification at the right Istanbul time; the morning digest lands at 07:00.

### Stage 3 — Money & documents
`cekler`, `hakedisler`, `belgeler`, `malzemeler`, `taseronlar` CRUD + UI; nightly
materialization job (`turetilmis` reminders: çek T-7/T-1/T-0, belge T-30/T-7/T-1, hakediş
T-3/T-0, malzeme T-0). Çek list ordered by vade with durum chips. **Exit criterion:** a çek
entered with a vade next week generates its warning pushes with zero manual reminder setup.

### Stage 4 — Search + kurulum + Shortcuts
FTS5 trigram index + triggers + `/search` + search UI. `device_tokens` + management UI.
`/kurulum` onboarding page (install steps, token display, iCloud shortcut links). Author the 3
shortcuts on-phone from `shortcuts/` recipes; **field-test Turkish dictation with şantiye
vocabulary on abi's actual iPhone.** **Exit criterion:** "Hey Siri, Şakül not" → dictated
Turkish sentence → appears in the app; searching `beton` finds it.

### Stage 5 — Hardening
Offline note outbox (IndexedDB + Background Sync fallback queue), Telegram bot as optional
second channel (same sender loop), Hetzner Backups enabled, uptime/error visibility (PM2 logs +
a `/api/health` deep-health endpoint), restore-from-backup drill documented in DEPLOYMENT.md.

### Stage 6 — Intelligence (explicitly future; nothing in v1 blocks it)
- AI chat over the knowledge base (`claude-opus-5`): answers from notes/files/records with citations
- Smart proposals (`claude-haiku-4-5`): note text → suggested reminder ("3 gün sonra betonu
  kontrol et" → proposed row, human confirms), auto-tagging, attach-note-to-project suggestions
- Cost expectation at this scale: single-digit dollars/month

---

## 11. Ops runbook pointers

- Deploy: `git push production main` (hook: install → build → `pm2 restart sakul-api`)
- Logs: `ssh deploy@… "pm2 logs sakul-api"` — PM2 is **per-user**; the app runs as `deploy`, so `pm2 list` as root shows nothing
- DB: `/var/www/sakul/data/sakul.db` (WAL) — backup = copy `.db` + `.db-wal` after `wal_checkpoint`, or use `sqlite3 .backup`
- Existing box facts: yildiz360-api on :3001 (PM2, user `deploy`), nginx vhost per site, certbot auto-renew
- Open ops debts (pre-existing, flagged): Hetzner Backups disabled; yıldız_group repo has a committed `DEPLOYMENT.md` containing the DuckDNS token + account identifiers
