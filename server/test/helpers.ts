import request from 'supertest';
import type { Express } from 'express';
import { db, schema } from '../src/db/index.js';
import { hashPassword } from '../src/lib/auth.js';

export const TEST_USER = { username: 'testuser', password: 'test-password-123' };

export async function ensureTestUser() {
  const existing = db.query.users.findFirst().sync();
  if (existing) return existing;
  return db
    .insert(schema.users)
    .values({
      username: TEST_USER.username,
      passwordHash: await hashPassword(TEST_USER.password),
      displayName: 'Test User',
    })
    .returning()
    .get();
}

/** Login and return a supertest agent that carries the session cookie. */
export async function loginAgent(app: Express) {
  await ensureTestUser();
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send(TEST_USER);
  if (res.status !== 200) throw new Error(`login failed in test helper: ${res.status}`);
  return agent;
}
