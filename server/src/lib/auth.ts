import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { eq, lt } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export const SESSION_COOKIE = 'sakul_session';
const SESSION_DAYS = 30;

export function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 11);
}

export function createSession(userId: number): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000).toISOString();
  db.insert(schema.sessions).values({ tokenHash: sha256(token), userId, expiresAt }).run();
  // opportunistic cleanup of expired sessions
  db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, new Date().toISOString())).run();
  return { token, expiresAt };
}

export function findSession(token: string) {
  const row = db.query.sessions.findFirst({ where: eq(schema.sessions.tokenHash, sha256(token)) }).sync();
  if (!row || row.expiresAt < new Date().toISOString()) return null;
  return row;
}

export function destroySession(token: string) {
  db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, sha256(token))).run();
}
