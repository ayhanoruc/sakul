import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { desc, eq, sql, and, type SQL } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { uploadsDir } from '../lib/env.js';
import { parseBody, idParam } from '../lib/validate.js';

export const dosyalarRouter = Router();

const MAX_BYTES = 25 * 1024 * 1024;

// MIME allowlist → canonical extension. User-supplied names never touch the filesystem.
const ALLOWED: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
};

const upload = multer({
  storage: multer.memoryStorage(), // 25MB cap makes memory fine; we hash + write ourselves
  limits: { fileSize: MAX_BYTES },
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype in ALLOWED);
  },
});

const KATEGORILER = ['sozlesme', 'ruhsat', 'cek_goruntu', 'fatura', 'foto', 'diger'] as const;

const metadataSchema = z.object({
  projeId: z.coerce.number().int().positive().nullish(),
  kategori: z.enum(KATEGORILER).default('diger'),
  aciklama: z.string().max(2000).nullish(),
  etiketler: z.string().max(500).nullish(), // comma-separated
});

dosyalarRouter.get('/', (req, res) => {
  const filters: SQL[] = [];
  if (req.query.proje) filters.push(eq(schema.dosyalar.projeId, Number(req.query.proje)));
  if (req.query.kategori)
    filters.push(eq(schema.dosyalar.kategori, String(req.query.kategori) as (typeof KATEGORILER)[number]));
  const base = db.select().from(schema.dosyalar);
  const rows = (filters.length ? base.where(and(...filters)) : base)
    .orderBy(desc(schema.dosyalar.createdAt))
    .limit(Math.min(Number(req.query.limit) || 100, 500))
    .all();
  res.json(rows);
});

dosyalarRouter.post('/', upload.single('file'), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'file_missing_or_type_not_allowed', allowed: Object.keys(ALLOWED) });
    return;
  }
  const meta = parseBody(metadataSchema, req, res);
  if (!meta) return;

  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

  // dedupe: identical bytes already stored → return the existing row
  const dupe = db.query.dosyalar.findFirst({ where: eq(schema.dosyalar.sha256, sha256) }).sync();
  if (dupe) {
    res.status(200).json({ ...dupe, duplicate: true });
    return;
  }

  const now = new Date();
  const relDir = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const ext = ALLOWED[req.file.mimetype];
  const relPath = `${relDir}/${crypto.randomUUID()}${ext}`;
  const absDir = path.join(uploadsDir, relDir);
  fs.mkdirSync(absDir, { recursive: true });
  fs.writeFileSync(path.join(uploadsDir, relPath), req.file.buffer);

  // multer decodes filenames as latin1; recover UTF-8 (Turkish characters in names)
  const orijinalAd = Buffer.from(req.file.originalname, 'latin1').toString('utf8');

  const row = db
    .insert(schema.dosyalar)
    .values({
      projeId: meta.projeId ?? null,
      orijinalAd,
      saklananYol: relPath,
      mime: req.file.mimetype,
      boyutByte: req.file.size,
      sha256,
      kategori: meta.kategori,
      aciklama: meta.aciklama ?? null,
      etiketler: meta.etiketler ?? null,
    })
    .returning()
    .get();
  res.status(201).json(row);
});

dosyalarRouter.get('/:id/download', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db.query.dosyalar.findFirst({ where: eq(schema.dosyalar.id, id) }).sync();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const abs = path.join(uploadsDir, row.saklananYol);
  if (!fs.existsSync(abs)) {
    res.status(410).json({ error: 'file_gone' });
    return;
  }
  res.setHeader('Content-Type', row.mime);
  // inline lets images/PDFs open in the browser; the filename survives a save
  res.setHeader(
    'Content-Disposition',
    `inline; filename*=UTF-8''${encodeURIComponent(row.orijinalAd)}`,
  );
  fs.createReadStream(abs).pipe(res);
});

dosyalarRouter.put('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const data = parseBody(metadataSchema.partial(), req, res);
  if (!data) return;
  const row = db
    .update(schema.dosyalar)
    .set({ ...data, updatedAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))` })
    .where(eq(schema.dosyalar.id, id))
    .returning()
    .get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json(row);
});

dosyalarRouter.delete('/:id', (req, res) => {
  const id = idParam(req, res);
  if (id === null) return;
  const row = db.delete(schema.dosyalar).where(eq(schema.dosyalar.id, id)).returning().get();
  if (!row) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  // DB row is the source of truth; remove bytes best-effort
  fs.rm(path.join(uploadsDir, row.saklananYol), () => {});
  res.json({ ok: true });
});
