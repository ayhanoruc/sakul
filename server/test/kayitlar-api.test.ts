import { describe, it, expect, beforeAll } from 'vitest';
import type { Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { loginAgent } from './helpers.js';
import { addDays, trtDateOf } from '../src/lib/time.js';

const app = createApp();
let agent: TestAgent<Test>;
let projeId: number;
const TODAY = trtDateOf(new Date());

beforeAll(async () => {
  agent = await loginAgent(app);
  const p = await agent.post('/api/projeler').send({ ad: 'Kayıt API Projesi' });
  projeId = p.body.id;
});

describe('cekler API', () => {
  let cekId: number;

  it('creates a çek and auto-generates its vade warnings', async () => {
    const res = await agent.post('/api/cekler').send({
      yon: 'verilen',
      karsiTaraf: 'Demir Ticaret',
      tutarKurus: 25_000_000,
      vadeTarihi: addDays(TODAY, 12),
      banka: 'İş Bankası',
      cekNo: 'A-0042',
      projeId,
    });
    expect(res.status).toBe(201);
    expect(res.body.durum).toBe('beklemede');
    cekId = res.body.id;

    const reminders = await agent.get('/api/hatirlaticilar');
    const derived = reminders.body.filter(
      (r: { kaynakTablo: string; kaynakId: number }) => r.kaynakTablo === 'cekler' && r.kaynakId === cekId,
    );
    expect(derived).toHaveLength(3); // T-7, T-1, T-0
    expect(derived[0].baslik).toContain('₺250.000,00');
  });

  it('rejects a çek without vade or karsiTaraf, and float amounts', async () => {
    expect((await agent.post('/api/cekler').send({ yon: 'verilen', karsiTaraf: 'X', tutarKurus: 100 })).status).toBe(400);
    expect(
      (await agent.post('/api/cekler').send({ yon: 'verilen', tutarKurus: 100, vadeTarihi: addDays(TODAY, 3) })).status,
    ).toBe(400);
    expect(
      (
        await agent.post('/api/cekler').send({
          yon: 'verilen',
          karsiTaraf: 'X',
          tutarKurus: 100.5, // kuruş must be an integer
          vadeTarihi: addDays(TODAY, 3),
        })
      ).status,
    ).toBe(400);
  });

  it('marking odendi removes the pending warnings', async () => {
    const res = await agent.put(`/api/cekler/${cekId}`).send({ durum: 'odendi' });
    expect(res.status).toBe(200);

    const reminders = await agent.get('/api/hatirlaticilar');
    const pending = reminders.body.filter(
      (r: { kaynakTablo: string; kaynakId: number; durum: string }) =>
        r.kaynakTablo === 'cekler' && r.kaynakId === cekId && r.durum === 'bekliyor',
    );
    expect(pending).toHaveLength(0);
  });

  it('lists çeks sorted by vade and filters by durum', async () => {
    await agent.post('/api/cekler').send({
      yon: 'alinan',
      karsiTaraf: 'Mal Sahibi',
      tutarKurus: 1_000_00,
      vadeTarihi: addDays(TODAY, 3),
    });
    const all = await agent.get('/api/cekler');
    const vades = all.body.map((c: { vadeTarihi: string }) => c.vadeTarihi);
    expect([...vades].sort()).toEqual(vades);

    const open = await agent.get('/api/cekler?durum=beklemede');
    expect(open.body.every((c: { durum: string }) => c.durum === 'beklemede')).toBe(true);
  });

  it('deleting a çek removes its pending warnings too', async () => {
    const cek = await agent.post('/api/cekler').send({
      yon: 'verilen',
      karsiTaraf: 'Silinecek',
      tutarKurus: 100,
      vadeTarihi: addDays(TODAY, 9),
    });
    expect((await agent.delete(`/api/cekler/${cek.body.id}`)).status).toBe(200);
    const reminders = await agent.get('/api/hatirlaticilar');
    expect(
      reminders.body.filter(
        (r: { kaynakTablo: string; kaynakId: number; durum: string }) =>
          r.kaynakTablo === 'cekler' && r.kaynakId === cek.body.id && r.durum === 'bekliyor',
      ),
    ).toHaveLength(0);
  });
});

describe('hakedisler API', () => {
  it('creates, requires a project, generates warnings, clears on payment', async () => {
    expect((await agent.post('/api/hakedisler').send({ yon: 'giden', tutarKurus: 100 })).status).toBe(400);

    const h = await agent.post('/api/hakedisler').send({
      projeId,
      yon: 'giden',
      tutarKurus: 7_500_000,
      vadeTarihi: addDays(TODAY, 6),
      aciklama: 'Kaba inşaat 2. hakediş',
    });
    expect(h.status).toBe(201);

    let reminders = await agent.get('/api/hatirlaticilar');
    expect(
      reminders.body.filter(
        (r: { kaynakTablo: string; kaynakId: number }) => r.kaynakTablo === 'hakedisler' && r.kaynakId === h.body.id,
      ),
    ).toHaveLength(2); // T-3, T-0

    await agent.put(`/api/hakedisler/${h.body.id}`).send({ odendiMi: 1, odemeTarihi: TODAY });
    reminders = await agent.get('/api/hatirlaticilar');
    expect(
      reminders.body.filter(
        (r: { kaynakTablo: string; kaynakId: number; durum: string }) =>
          r.kaynakTablo === 'hakedisler' && r.kaynakId === h.body.id && r.durum === 'bekliyor',
      ),
    ).toHaveLength(0);
  });
});

describe('belgeler API', () => {
  it('creates a belge with expiry and generates T-30/T-7/T-1', async () => {
    const b = await agent.post('/api/belgeler').send({
      projeId,
      tur: 'sigorta',
      verilisTarihi: TODAY,
      gecerlilikBitis: addDays(TODAY, 60),
      aciklama: 'All-risk poliçe',
    });
    expect(b.status).toBe(201);
    const reminders = await agent.get('/api/hatirlaticilar');
    expect(
      reminders.body.filter(
        (r: { kaynakTablo: string; kaynakId: number }) => r.kaynakTablo === 'belgeler' && r.kaynakId === b.body.id,
      ),
    ).toHaveLength(3);
  });

  it('rejects invalid tur', async () => {
    expect((await agent.post('/api/belgeler').send({ projeId, tur: 'tapu' })).status).toBe(400);
  });
});

describe('malzemeler API', () => {
  it('creates a malzeme with delivery reminder, clears when received', async () => {
    const m = await agent.post('/api/malzemeler').send({
      projeId,
      ad: 'Nervürlü demir 14mm',
      tedarikci: 'Demir A.Ş.',
      miktar: 12,
      birim: 'ton',
      teslimTarihi: addDays(TODAY, 4),
    });
    expect(m.status).toBe(201);

    let reminders = await agent.get('/api/hatirlaticilar');
    expect(
      reminders.body.filter(
        (r: { kaynakTablo: string; kaynakId: number }) => r.kaynakTablo === 'malzemeler' && r.kaynakId === m.body.id,
      ),
    ).toHaveLength(1);

    await agent.put(`/api/malzemeler/${m.body.id}`).send({ teslimAlindiMi: 1 });
    reminders = await agent.get('/api/hatirlaticilar');
    expect(
      reminders.body.filter(
        (r: { kaynakTablo: string; kaynakId: number; durum: string }) =>
          r.kaynakTablo === 'malzemeler' && r.kaynakId === m.body.id && r.durum === 'bekliyor',
      ),
    ).toHaveLength(0);
  });
});

describe('taseronlar API', () => {
  it('full CRUD', async () => {
    const t = await agent.post('/api/taseronlar').send({
      ad: 'Kalıpçı Veli',
      isKolu: 'kalıp',
      telefon: '0532 111 22 33',
      anlasilanTutarKurus: 40_000_000,
      projeId,
    });
    expect(t.status).toBe(201);

    const upd = await agent.put(`/api/taseronlar/${t.body.id}`).send({ telefon: '0532 999 88 77' });
    expect(upd.body.telefon).toBe('0532 999 88 77');

    const list = await agent.get(`/api/taseronlar?proje=${projeId}`);
    expect(list.body.some((x: { id: number }) => x.id === t.body.id)).toBe(true);

    expect((await agent.delete(`/api/taseronlar/${t.body.id}`)).status).toBe(200);
  });

  it('all Stage 3 routes require auth', async () => {
    const request = (await import('supertest')).default;
    for (const url of ['/api/cekler', '/api/hakedisler', '/api/belgeler', '/api/malzemeler', '/api/taseronlar']) {
      expect((await request(app).get(url)).status).toBe(401);
    }
  });
});
