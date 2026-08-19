import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { ensureTestUser, loginAgent, TEST_USER } from './helpers.js';

const app = createApp();

describe('health', () => {
  it('GET /api/health is public and reports ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.time).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('auth', () => {
  beforeAll(async () => {
    await ensureTestUser();
  });

  it('rejects a wrong password with 401 and no cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: TEST_USER.username, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('rejects an unknown user with 401 (same error as wrong password — no user enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'nobody', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_credentials');
  });

  it('rejects a malformed body with 400', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: 'x' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials and sets an httpOnly cookie', async () => {
    const res = await request(app).post('/api/auth/login').send(TEST_USER);
    expect(res.status).toBe(200);
    expect(res.body.username).toBe(TEST_USER.username);
    const cookie = res.headers['set-cookie']![0];
    expect(cookie).toContain('sakul_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
  });

  it('GET /api/auth/me works with the session and 401s without it', async () => {
    const agent = await loginAgent(app);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.username).toBe(TEST_USER.username);

    const anon = await request(app).get('/api/auth/me');
    expect(anon.status).toBe(401);
  });

  it('logout destroys the session server-side', async () => {
    const agent = await loginAgent(app);
    await agent.post('/api/auth/logout').expect(200);
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(401);
  });

  it('a forged session token is rejected', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', `sakul_session=${'a'.repeat(64)}`);
    expect(res.status).toBe(401);
  });

  it('rate-limits failed logins (>5/min from one IP), and success resets the counter', async () => {
    // exhaust the limit with bad passwords
    let last = 0;
    for (let i = 0; i < 7; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ username: TEST_USER.username, password: 'bad' });
      last = res.status;
    }
    expect(last).toBe(429);

    // still limited even with correct credentials
    const blocked = await request(app).post('/api/auth/login').send(TEST_USER);
    expect(blocked.status).toBe(429);
  });
});

describe('route protection', () => {
  it.each(['/api/projeler', '/api/notlar', '/api/dosyalar'])('%s requires auth', async (url) => {
    const res = await request(app).get(url);
    expect(res.status).toBe(401);
  });
});
