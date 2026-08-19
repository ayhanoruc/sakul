import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import type { Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { loginAgent } from './helpers.js';

const app = createApp();
let agent: TestAgent<Test>;

// A real 1x1 red PNG — a mock "şantiye photo"
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);
// A minimal valid PDF — a mock "sözleşme"
const PDF_MIN = Buffer.from(
  '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
    '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\nxref\n0 4\ntrailer<</Size 4/Root 1 0 R>>\n%%EOF',
);

beforeAll(async () => {
  agent = await loginAgent(app);
});

describe('dosyalar — upload', () => {
  let fileId: number;

  it('uploads a photo with Turkish filename + metadata', async () => {
    const res = await agent
      .post('/api/dosyalar')
      .field('kategori', 'foto')
      .field('aciklama', 'Kolon demirleri — güney cephe')
      .field('etiketler', 'demir,kolon,güney')
      .attach('file', PNG_1PX, { filename: 'şantiye-güney.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.orijinalAd).toBe('şantiye-güney.png');
    expect(res.body.mime).toBe('image/png');
    expect(res.body.kategori).toBe('foto');
    expect(res.body.boyutByte).toBe(PNG_1PX.length);
    expect(res.body.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(res.body.saklananYol).toMatch(/^\d{4}\/\d{2}\/[0-9a-f-]{36}\.png$/);
    fileId = res.body.id;
  });

  it('stores the bytes on disk under DATA_DIR/uploads', async () => {
    const res = await agent.get('/api/dosyalar');
    const row = res.body.find((f: { id: number }) => f.id === fileId);
    const abs = path.join(process.env.DATA_DIR!, 'uploads', row.saklananYol);
    expect(fs.existsSync(abs)).toBe(true);
    expect(fs.readFileSync(abs).equals(PNG_1PX)).toBe(true);
  });

  it('deduplicates identical bytes (same sha256 → existing row, no new file)', async () => {
    const res = await agent
      .post('/api/dosyalar')
      .attach('file', PNG_1PX, { filename: 'kopya.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.duplicate).toBe(true);
    expect(res.body.id).toBe(fileId);
  });

  it('uploads a PDF as sözleşme', async () => {
    const res = await agent
      .post('/api/dosyalar')
      .field('kategori', 'sozlesme')
      .attach('file', PDF_MIN, { filename: 'kaba-insaat-sozlesmesi.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.kategori).toBe('sozlesme');
  });

  it('rejects a disallowed MIME type (executable)', async () => {
    const res = await agent
      .post('/api/dosyalar')
      .attach('file', Buffer.from('MZ...'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('file_missing_or_type_not_allowed');
  });

  it('rejects a missing file', async () => {
    const res = await agent.post('/api/dosyalar').field('kategori', 'foto');
    expect(res.status).toBe(400);
  });

  it('rejects an invalid kategori', async () => {
    const res = await agent
      .post('/api/dosyalar')
      .field('kategori', 'gizli')
      .attach('file', PDF_MIN, { filename: 'x.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(400);
  });

  it('rejects files over 25MB with 413', async () => {
    const big = Buffer.alloc(25 * 1024 * 1024 + 1, 1);
    const res = await agent
      .post('/api/dosyalar')
      .attach('file', big, { filename: 'buyuk.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(413);
    expect(res.body.error).toBe('file_too_large');
  });
});

describe('dosyalar — download (privacy-critical)', () => {
  let fileId: number;

  beforeAll(async () => {
    const res = await agent
      .post('/api/dosyalar')
      .field('kategori', 'cek_goruntu')
      .attach('file', Buffer.concat([PNG_1PX, Buffer.from('unique-cek')]), {
        filename: 'çek-önü.png',
        contentType: 'image/png',
      });
    fileId = res.body.id;
  });

  it('streams the exact bytes back with correct headers', async () => {
    const res = await agent.get(`/api/dosyalar/${fileId}/download`).buffer().parse(
      (r, cb) => {
        const chunks: Buffer[] = [];
        r.on('data', (c) => chunks.push(c));
        r.on('end', () => cb(null, Buffer.concat(chunks)));
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
    expect((res.body as Buffer).length).toBe(PNG_1PX.length + 'unique-cek'.length);
  });

  it('REFUSES download without a session — files must never be public', async () => {
    const res = await request(app).get(`/api/dosyalar/${fileId}/download`);
    expect(res.status).toBe(401);
  });

  it('404s for a nonexistent file id', async () => {
    expect((await agent.get('/api/dosyalar/99999/download')).status).toBe(404);
  });
});

describe('dosyalar — metadata & lifecycle', () => {
  it('filters by kategori and by project', async () => {
    const proje = await agent.post('/api/projeler').send({ ad: 'Dosya Filtre Projesi' });
    await agent
      .post('/api/dosyalar')
      .field('kategori', 'ruhsat')
      .field('projeId', String(proje.body.id))
      .attach('file', Buffer.concat([PDF_MIN, Buffer.from('ruhsat-unique')]), {
        filename: 'yapi-ruhsati.pdf',
        contentType: 'application/pdf',
      });

    const byKat = await agent.get('/api/dosyalar?kategori=ruhsat');
    expect(byKat.body.length).toBeGreaterThanOrEqual(1);
    expect(byKat.body.every((f: { kategori: string }) => f.kategori === 'ruhsat')).toBe(true);

    const byProje = await agent.get(`/api/dosyalar?proje=${proje.body.id}`);
    expect(byProje.body.length).toBe(1);
  });

  it('updates metadata without touching the file', async () => {
    const up = await agent
      .post('/api/dosyalar')
      .attach('file', Buffer.concat([PNG_1PX, Buffer.from('meta-test')]), {
        filename: 'meta.png',
        contentType: 'image/png',
      });
    const res = await agent
      .put(`/api/dosyalar/${up.body.id}`)
      .send({ aciklama: 'Açıklama sonradan eklendi', etiketler: 'test,meta' });
    expect(res.status).toBe(200);
    expect(res.body.aciklama).toBe('Açıklama sonradan eklendi');
    expect(res.body.sha256).toBe(up.body.sha256);
  });

  it('delete removes the row and the bytes', async () => {
    const up = await agent
      .post('/api/dosyalar')
      .attach('file', Buffer.concat([PNG_1PX, Buffer.from('delete-me')]), {
        filename: 'sil.png',
        contentType: 'image/png',
      });
    const abs = path.join(process.env.DATA_DIR!, 'uploads', up.body.saklananYol);
    expect(fs.existsSync(abs)).toBe(true);

    expect((await agent.delete(`/api/dosyalar/${up.body.id}`)).status).toBe(200);
    expect((await agent.get(`/api/dosyalar/${up.body.id}/download`)).status).toBe(404);
    // bytes removal is async best-effort; poll briefly
    await new Promise((r) => setTimeout(r, 200));
    expect(fs.existsSync(abs)).toBe(false);
  });
});
