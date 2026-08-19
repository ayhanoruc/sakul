import { describe, it, expect, beforeAll } from 'vitest';
import type { Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { loginAgent } from './helpers.js';

const app = createApp();
let agent: TestAgent<Test>;

beforeAll(async () => {
  agent = await loginAgent(app);
  // seed searchable content
  const proje = await agent.post('/api/projeler').send({
    ad: 'Menekşe Apartmanı',
    adres: 'Gül Sokak No:3',
    malSahibi: 'Osman Menekşe',
  });
  await agent.post('/api/notlar').send({
    icerik: 'Betonun mukavemet raporu geldi, C30 çıktı. Kalıpçıya söyle.',
    projeId: proje.body.id,
  });
  await agent.post('/api/notlar').send({ icerik: 'Elektrik panosu için ruhsat fotokopisi lazım' });
  await agent
    .post('/api/dosyalar')
    .field('kategori', 'fatura')
    .field('aciklama', 'Beton santrali ağustos faturası')
    .field('etiketler', 'beton,fatura,ağustos')
    .attach('file', Buffer.from('fake-pdf-bytes-for-search'), {
      filename: 'beton-faturasi.pdf',
      contentType: 'application/pdf',
    });
});

describe('search — FTS5 trigram', () => {
  it('rejects queries under 3 characters', async () => {
    const res = await agent.get('/api/search?q=ab');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('query_too_short');
  });

  it('finds exact words across entities', async () => {
    const res = await agent.get('/api/search?q=beton');
    expect(res.status).toBe(200);
    expect(res.body.notlar.length).toBeGreaterThanOrEqual(1);
    expect(res.body.dosyalar.length).toBeGreaterThanOrEqual(1);
  });

  it('matches Turkish suffixed forms — the reason trigram was chosen', async () => {
    // stored text says "Betonun" (genitive); searching the stem must hit it
    const res = await agent.get('/api/search?q=beton');
    const hit = res.body.notlar.find((n: { icerik: string }) => n.icerik.includes('Betonun'));
    expect(hit).toBeTruthy();
    expect(hit.snippet).toContain('<b>');
  });

  it('searches inside file metadata (name, description, tags)', async () => {
    const res = await agent.get('/api/search?q=santral'); // only in the aciklama
    expect(res.body.dosyalar.length).toBeGreaterThanOrEqual(1);
    expect(res.body.dosyalar[0].orijinalAd).toBe('beton-faturasi.pdf');
  });

  it('finds projects by owner name', async () => {
    const res = await agent.get('/api/search?q=Osman');
    expect(res.body.projeler.length).toBe(1);
    expect(res.body.projeler[0].ad).toBe('Menekşe Apartmanı');
  });

  it('is case-insensitive for Turkish text', async () => {
    const res = await agent.get('/api/search?q=MENEKŞE');
    expect(res.body.projeler.length).toBeGreaterThanOrEqual(1);
  });

  it('updated content is reindexed; deleted content drops out', async () => {
    const not = await agent.post('/api/notlar').send({ icerik: 'aramada bulunacak kelime: zebra' });
    expect((await agent.get('/api/search?q=zebra')).body.notlar).toHaveLength(1);

    await agent.put(`/api/notlar/${not.body.id}`).send({ icerik: 'artık başka bir şey: jaguar' });
    expect((await agent.get('/api/search?q=zebra')).body.notlar).toHaveLength(0);
    expect((await agent.get('/api/search?q=jaguar')).body.notlar).toHaveLength(1);

    await agent.delete(`/api/notlar/${not.body.id}`);
    expect((await agent.get('/api/search?q=jaguar')).body.notlar).toHaveLength(0);
  });

  it('treats FTS operators as literal text (no query injection)', async () => {
    for (const q of ['beton AND', 'beton*', '"beton', 'NOT beton OR (x)']) {
      const res = await agent.get(`/api/search?q=${encodeURIComponent(q)}`);
      expect(res.status).toBe(200); // never a 500
    }
  });

  it('requires auth', async () => {
    const request = (await import('supertest')).default;
    expect((await request(app).get('/api/search?q=beton')).status).toBe(401);
  });
});
