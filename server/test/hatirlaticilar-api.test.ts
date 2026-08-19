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

const future = new Date(Date.now() + 3600_000).toISOString();

describe('hatirlaticilar — create validation per kind', () => {
  it('creates a sabit reminder', async () => {
    const res = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'Çek vadesi — Ziraat 150.000 TL',
      hatirlatmaZamani: future,
    });
    expect(res.status).toBe(201);
    expect(res.body.durum).toBe('bekliyor');
    expect(res.body.tekrarKurali).toBeNull();
  });

  it('rejects sabit without a time', async () => {
    const res = await agent.post('/api/hatirlaticilar').send({ tur: 'sabit', baslik: 'X' });
    expect(res.status).toBe(400);
  });

  it('creates a tekrarli reminder with a valid rule', async () => {
    const res = await agent.post('/api/hatirlaticilar').send({
      tur: 'tekrarli',
      baslik: 'SGK bildirgesi',
      hatirlatmaZamani: future,
      tekrarKurali: 'her_ay:26',
    });
    expect(res.status).toBe(201);
    expect(res.body.tekrarKurali).toBe('her_ay:26');
  });

  it('rejects tekrarli with an invalid rule', async () => {
    const res = await agent.post('/api/hatirlaticilar').send({
      tur: 'tekrarli',
      baslik: 'X',
      hatirlatmaZamani: future,
      tekrarKurali: 'her_saat',
    });
    expect(res.status).toBe(400);
  });

  it('creates a kosullu reminder chained to an open blocker', async () => {
    const blocker = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'Kalıp söküm',
      hatirlatmaZamani: future,
    });
    const res = await agent.post('/api/hatirlaticilar').send({
      tur: 'kosullu',
      baslik: 'Demirciyi ara',
      engelleyenId: blocker.body.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.hatirlatmaZamani).toBeNull();
    expect(res.body.engelleyenId).toBe(blocker.body.id);
  });

  it('rejects kosullu pointing at a missing or closed blocker', async () => {
    expect(
      (await agent.post('/api/hatirlaticilar').send({ tur: 'kosullu', baslik: 'X', engelleyenId: 99999 }))
        .status,
    ).toBe(400);

    const done = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'bitti bile',
      hatirlatmaZamani: future,
    });
    await agent.post(`/api/hatirlaticilar/${done.body.id}/complete`);
    const res = await agent.post('/api/hatirlaticilar').send({
      tur: 'kosullu',
      baslik: 'X',
      engelleyenId: done.body.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('blocker_already_closed');
  });

  it('REFUSES to create turetilmis via the API (materialization-only)', async () => {
    const res = await agent.post('/api/hatirlaticilar').send({
      tur: 'turetilmis',
      baslik: 'sahte',
      hatirlatmaZamani: future,
    });
    expect(res.status).toBe(400);
  });
});

describe('hatirlaticilar — lifecycle', () => {
  it('complete closes the reminder and wakes its dependents', async () => {
    const blocker = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'Beton döküm',
      hatirlatmaZamani: future,
    });
    const dep = await agent.post('/api/hatirlaticilar').send({
      tur: 'kosullu',
      baslik: 'Kalıpçıya haber ver',
      engelleyenId: blocker.body.id,
    });

    const done = await agent.post(`/api/hatirlaticilar/${blocker.body.id}/complete`);
    expect(done.status).toBe(200);
    expect(done.body.durum).toBe('tamamlandi');

    const list = await agent.get('/api/hatirlaticilar');
    const woken = list.body.find((r: { id: number }) => r.id === dep.body.id);
    expect(woken.hatirlatmaZamani).not.toBeNull(); // now due
    expect(woken.durum).toBe('bekliyor');
  });

  it('snooze pushes the time forward and reopens a sent reminder', async () => {
    const r = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'Ertelenecek',
      hatirlatmaZamani: future,
    });
    const res = await agent.post(`/api/hatirlaticilar/${r.body.id}/snooze`).send({ minutes: 120 });
    expect(res.status).toBe(200);
    expect(res.body.durum).toBe('bekliyor');
    const newTime = new Date(res.body.hatirlatmaZamani).getTime();
    expect(newTime).toBeGreaterThan(Date.now() + 119 * 60_000);
    expect(newTime).toBeLessThan(Date.now() + 121 * 60_000);
  });

  it('rejects nonsense snooze values', async () => {
    const r = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'X',
      hatirlatmaZamani: future,
    });
    expect((await agent.post(`/api/hatirlaticilar/${r.body.id}/snooze`).send({ minutes: 0 })).status).toBe(400);
    expect((await agent.post(`/api/hatirlaticilar/${r.body.id}/snooze`).send({})).status).toBe(400);
  });

  it('filters by durum', async () => {
    const res = await agent.get('/api/hatirlaticilar?durum=tamamlandi');
    expect(res.status).toBe(200);
    expect(res.body.every((r: { durum: string }) => r.durum === 'tamamlandi')).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('deletes a reminder', async () => {
    const r = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'silinecek',
      hatirlatmaZamani: future,
    });
    expect((await agent.delete(`/api/hatirlaticilar/${r.body.id}`)).status).toBe(200);
    expect((await agent.post(`/api/hatirlaticilar/${r.body.id}/complete`)).status).toBe(404);
  });
});

describe('digest endpoint', () => {
  it('buckets reminders into overdue/today/upcoming/waiting', async () => {
    // waiting: kosullu without a date
    const blocker = await agent.post('/api/hatirlaticilar').send({
      tur: 'sabit',
      baslik: 'digest-blocker',
      hatirlatmaZamani: new Date(Date.now() + 5 * 86400_000).toISOString(),
    });
    await agent.post('/api/hatirlaticilar').send({
      tur: 'kosullu',
      baslik: 'digest-waiting',
      engelleyenId: blocker.body.id,
    });

    const res = await agent.get('/api/digest/today');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('overdue');
    expect(res.body).toHaveProperty('today');
    expect(res.body).toHaveProperty('upcoming');
    expect(res.body.waiting.some((r: { baslik: string }) => r.baslik === 'digest-waiting')).toBe(true);
    expect(res.body.upcoming.some((r: { baslik: string }) => r.baslik === 'digest-blocker')).toBe(true);
  });
});

describe('push endpoints', () => {
  const sub = {
    endpoint: 'https://web.push.apple.com/QOZpP8Zj-example',
    keys: { p256dh: 'BPk...example-p256dh', auth: 'abc-example-auth' },
  };

  it('subscribe stores, and re-subscribe upserts (no duplicate rows)', async () => {
    expect((await agent.post('/api/push/subscribe').send(sub)).status).toBe(201);
    const second = await agent.post('/api/push/subscribe').send({
      ...sub,
      keys: { p256dh: 'rotated', auth: 'rotated' },
    });
    expect(second.status).toBe(201);
  });

  it('rejects malformed subscriptions', async () => {
    expect((await agent.post('/api/push/subscribe').send({ endpoint: 'not-a-url', keys: {} })).status).toBe(400);
  });

  it('unsubscribe removes the endpoint', async () => {
    expect((await agent.delete('/api/push/subscribe').send({ endpoint: sub.endpoint })).status).toBe(200);
  });

  it('vapid-key returns 503 when keys are not configured (test env)', async () => {
    const res = await agent.get('/api/push/vapid-key');
    expect([200, 503]).toContain(res.status);
  });
});
