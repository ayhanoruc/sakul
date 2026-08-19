import { Router } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db, schema } from '../db/index.js';
import { parseBody } from '../lib/validate.js';
import { vapidPublicKey } from '../lib/push.js';

export const pushRouter = Router();

pushRouter.get('/vapid-key', (_req, res) => {
  const key = vapidPublicKey();
  if (!key) {
    res.status(503).json({ error: 'push_not_configured' });
    return;
  }
  res.json({ key });
});

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

pushRouter.post('/subscribe', (req, res) => {
  const data = parseBody(subscribeSchema, req, res);
  if (!data) return;
  const row = db
    .insert(schema.pushSubscriptions)
    .values({
      userId: req.userId!,
      endpoint: data.endpoint,
      p256dh: data.keys.p256dh,
      auth: data.keys.auth,
      lastSeenAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    })
    .onConflictDoUpdate({
      target: schema.pushSubscriptions.endpoint,
      set: {
        p256dh: data.keys.p256dh,
        auth: data.keys.auth,
        lastSeenAt: sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
      },
    })
    .returning()
    .get();
  res.status(201).json({ id: row.id });
});

pushRouter.delete('/subscribe', (req, res) => {
  const data = parseBody(z.object({ endpoint: z.string().url() }), req, res);
  if (!data) return;
  db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, data.endpoint)).run();
  res.json({ ok: true });
});
