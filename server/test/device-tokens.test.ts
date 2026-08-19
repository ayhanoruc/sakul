import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import type { Test } from 'supertest';
import type TestAgent from 'supertest/lib/agent.js';
import { createApp } from '../src/app.js';
import { loginAgent } from './helpers.js';

const app = createApp();
let agent: TestAgent<Test>;
let token: string;
let tokenId: number;

beforeAll(async () => {
  agent = await loginAgent(app);
});

describe('device tokens — lifecycle', () => {
  it('creates a token, returning the secret exactly once', async () => {
    const res = await agent.post('/api/device-tokens').send({ name: 'Abi iPhone' });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^sakul_[A-Za-z0-9_-]{43}$/);
    expect(res.body.scopes).toBe('notes:write,reminders:write');
    token = res.body.token;
    tokenId = res.body.id;
  });

  it('the list never exposes token material', async () => {
    const res = await agent.get('/api/device-tokens');
    expect(res.status).toBe(200);
    const row = res.body.find((r: { id: number }) => r.id === tokenId);
    expect(row.name).toBe('Abi iPhone');
    expect(row.token).toBeUndefined();
    expect(row.tokenHash).toBeUndefined();
  });

  it('management endpoints refuse device-token auth (session only)', async () => {
    const res = await request(app).get('/api/device-tokens').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});

describe('device tokens — capture auth (the iOS Shortcut path)', () => {
  it('POST /api/notlar works with a Bearer token, no cookie', async () => {
    const res = await request(app)
      .post('/api/notlar')
      .set('Authorization', `Bearer ${token}`)
      .send({ icerik: 'Siri üzerinden dikte edilen not', kaynak: 'shortcut' });
    expect(res.status).toBe(201);
    expect(res.body.kaynak).toBe('shortcut');
  });

  it('POST /api/hatirlaticilar works with a Bearer token', async () => {
    const res = await request(app)
      .post('/api/hatirlaticilar')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tur: 'sabit',
        baslik: 'Shortcut ile kurulan hatırlatıcı',
        hatirlatmaZamani: new Date(Date.now() + 3600_000).toISOString(),
      });
    expect(res.status).toBe(201);
  });

  it('updates last_used_at on use', async () => {
    const res = await agent.get('/api/device-tokens');
    const row = res.body.find((r: { id: number }) => r.id === tokenId);
    expect(row.lastUsedAt).not.toBeNull();
  });

  it('token CANNOT read anything — notes list, files, digest all refuse', async () => {
    for (const url of ['/api/notlar', '/api/dosyalar', '/api/digest/today', '/api/projeler', '/api/search?q=not']) {
      const res = await request(app).get(url).set('Authorization', `Bearer ${token}`);
      expect(res.status, url).toBe(401);
    }
  });

  it('token CANNOT hit non-create verbs (complete, snooze, delete)', async () => {
    const created = await request(app)
      .post('/api/hatirlaticilar')
      .set('Authorization', `Bearer ${token}`)
      .send({
        tur: 'sabit',
        baslik: 'scope testi',
        hatirlatmaZamani: new Date(Date.now() + 3600_000).toISOString(),
      });
    const id = created.body.id;
    expect(
      (await request(app).post(`/api/hatirlaticilar/${id}/complete`).set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
    expect(
      (await request(app).delete(`/api/hatirlaticilar/${id}`).set('Authorization', `Bearer ${token}`)).status,
    ).toBe(401);
  });

  it('a garbage token is rejected', async () => {
    const res = await request(app)
      .post('/api/notlar')
      .set('Authorization', 'Bearer sakul_forged-token-000000000000000000000000000')
      .send({ icerik: 'x' });
    expect(res.status).toBe(401);
  });

  it('revoke kills the token immediately; history row remains', async () => {
    expect((await agent.post(`/api/device-tokens/${tokenId}/revoke`)).status).toBe(200);

    const res = await request(app)
      .post('/api/notlar')
      .set('Authorization', `Bearer ${token}`)
      .send({ icerik: 'artık çalışmamalı' });
    expect(res.status).toBe(401);

    const list = await agent.get('/api/device-tokens');
    const row = list.body.find((r: { id: number }) => r.id === tokenId);
    expect(row.revokedAt).not.toBeNull();
  });
});
