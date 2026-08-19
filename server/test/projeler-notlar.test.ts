import { describe, it, expect, beforeAll } from 'vitest';
import type { Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { loginAgent } from './helpers.js';

const app = createApp();
let agent: TestAgent<Test>;

beforeAll(async () => {
  agent = await loginAgent(app);
});

describe('projeler CRUD', () => {
  let projeId: number;

  it('creates a project with Turkish characters intact', async () => {
    const res = await agent.post('/api/projeler').send({
      ad: 'Güneş Apartmanı',
      adres: 'Çamlıca Mah. 12. Sok. No:5',
      adaParsel: '145/8',
      malSahibi: 'Hüseyin Yıldız',
      baslangicTarihi: '2026-06-01',
    });
    expect(res.status).toBe(201);
    expect(res.body.ad).toBe('Güneş Apartmanı');
    expect(res.body.durum).toBe('aktif');
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    projeId = res.body.id;
  });

  it('rejects a project without a name', async () => {
    const res = await agent.post('/api/projeler').send({ adres: 'somewhere' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_body');
  });

  it('rejects an invalid durum enum value', async () => {
    const res = await agent.post('/api/projeler').send({ ad: 'X', durum: 'bitti' });
    expect(res.status).toBe(400);
  });

  it('rejects a malformed date', async () => {
    const res = await agent.post('/api/projeler').send({ ad: 'X', baslangicTarihi: '01.06.2026' });
    expect(res.status).toBe(400);
  });

  it('lists and gets by id', async () => {
    const list = await agent.get('/api/projeler');
    expect(list.status).toBe(200);
    expect(list.body.some((p: { id: number }) => p.id === projeId)).toBe(true);

    const one = await agent.get(`/api/projeler/${projeId}`);
    expect(one.status).toBe(200);
    expect(one.body.ad).toBe('Güneş Apartmanı');
  });

  it('updates partially and bumps updated_at', async () => {
    const before = await agent.get(`/api/projeler/${projeId}`);
    const res = await agent.put(`/api/projeler/${projeId}`).send({ durum: 'beklemede' });
    expect(res.status).toBe(200);
    expect(res.body.durum).toBe('beklemede');
    expect(res.body.ad).toBe('Güneş Apartmanı'); // untouched field survives
    expect(res.body.updatedAt >= before.body.updatedAt).toBe(true);
  });

  it('404s on a missing id and 400s on garbage ids', async () => {
    expect((await agent.get('/api/projeler/99999')).status).toBe(404);
    expect((await agent.get('/api/projeler/abc')).status).toBe(400);
    expect((await agent.put('/api/projeler/99999').send({ ad: 'Y' })).status).toBe(404);
  });

  it('deletes and then 404s', async () => {
    const tmp = await agent.post('/api/projeler').send({ ad: 'Silinecek' });
    expect((await agent.delete(`/api/projeler/${tmp.body.id}`)).status).toBe(200);
    expect((await agent.get(`/api/projeler/${tmp.body.id}`)).status).toBe(404);
  });
});

describe('notlar CRUD', () => {
  let projeId: number;

  beforeAll(async () => {
    const proje = await agent.post('/api/projeler').send({ ad: 'Not Test Projesi' });
    projeId = proje.body.id;
  });

  it('creates a bare note (no project — capture first, attach later)', async () => {
    const res = await agent.post('/api/notlar').send({
      icerik: 'Yarın sabah demirciyi ara, kolon demirleri eksik',
    });
    expect(res.status).toBe(201);
    expect(res.body.projeId).toBeNull();
    expect(res.body.kaynak).toBe('pwa');
  });

  it('creates a note attached to a project with kaynak=shortcut', async () => {
    const res = await agent.post('/api/notlar').send({
      icerik: 'Beton döküldü, 3 gün sonra kalıp sökülecek',
      projeId,
      kaynak: 'shortcut',
    });
    expect(res.status).toBe(201);
    expect(res.body.projeId).toBe(projeId);
    expect(res.body.kaynak).toBe('shortcut');
  });

  it('rejects an empty note and an over-long note', async () => {
    expect((await agent.post('/api/notlar').send({ icerik: '' })).status).toBe(400);
    expect((await agent.post('/api/notlar').send({ icerik: 'x'.repeat(10_001) })).status).toBe(400);
  });

  it('filters by project', async () => {
    const res = await agent.get(`/api/notlar?proje=${projeId}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].projeId).toBe(projeId);
  });

  it('lists newest first', async () => {
    const res = await agent.get('/api/notlar');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const dates = res.body.map((n: { createdAt: string }) => n.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
  });

  it('attaches an existing note to a project via PUT (the "attach later" flow)', async () => {
    const bare = await agent.post('/api/notlar').send({ icerik: 'Sonradan bağlanacak not' });
    const res = await agent.put(`/api/notlar/${bare.body.id}`).send({ projeId });
    expect(res.status).toBe(200);
    expect(res.body.projeId).toBe(projeId);
    expect(res.body.icerik).toBe('Sonradan bağlanacak not');
  });

  it('deletes a note', async () => {
    const tmp = await agent.post('/api/notlar').send({ icerik: 'silinecek' });
    expect((await agent.delete(`/api/notlar/${tmp.body.id}`)).status).toBe(200);
    const list = await agent.get('/api/notlar');
    expect(list.body.some((n: { id: number }) => n.id === tmp.body.id)).toBe(false);
  });
});
