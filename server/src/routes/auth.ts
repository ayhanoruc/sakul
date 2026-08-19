import { Router } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { SESSION_COOKIE, createSession, destroySession, verifyPassword } from '../lib/auth.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../lib/env.js';

export const authRouter = Router();

// naive in-memory rate limit: 5 attempts/min/IP
const attempts = new Map<string, { count: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  entry.count += 1;
  return entry.count > 5;
}

const loginSchema = z.object({ username: z.string().min(1), password: z.string().min(1) });

authRouter.post('/login', async (req, res) => {
  const ip = req.ip ?? 'unknown';
  if (rateLimited(ip)) {
    res.status(429).json({ error: 'too_many_attempts' });
    return;
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'invalid_body' });
    return;
  }
  const user = db.query.users.findFirst({
    where: eq(schema.users.username, parsed.data.username),
  }).sync();
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }
  attempts.delete(ip); // successful login resets the counter
  const { token, expiresAt } = createSession(user.id);
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: env.isProd,
    sameSite: 'lax',
    expires: new Date(expiresAt),
    path: '/',
  });
  res.json({ id: user.id, username: user.username, displayName: user.displayName });
});

authRouter.post('/logout', (req, res) => {
  const header = req.headers.cookie ?? '';
  const match = header.split(';').find((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));
  if (match) destroySession(match.trim().slice(SESSION_COOKIE.length + 1));
  res.clearCookie(SESSION_COOKIE, { path: '/' });
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  const user = db.query.users.findFirst({ where: eq(schema.users.id, req.userId!) }).sync()!;
  res.json({ id: user.id, username: user.username, displayName: user.displayName });
});
