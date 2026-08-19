import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/index.js';

export type PushPayload = { title: string; body?: string; url?: string; tag?: string };
export type PushResult = { endpoint: string; success: boolean; error?: string };

/** The worker depends on this signature so tests can inject a fake. */
export type PushSender = (payload: PushPayload) => Promise<PushResult[]>;

let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:admin@localhost', pub, priv);
  configured = true;
  return true;
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

/** Send to every stored subscription; prune the ones the push service reports dead. */
export const sendPushToAll: PushSender = async (payload) => {
  if (!ensureConfigured()) {
    console.warn('push: VAPID keys not set — skipping send');
    return [];
  }
  const subs = db.select().from(schema.pushSubscriptions).all();
  const results: PushResult[] = [];
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload),
        { TTL: 24 * 3600, urgency: 'high' },
      );
      results.push({ endpoint: sub.endpoint, success: true });
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        // subscription is dead (app removed / permission revoked) — prune it
        db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, sub.id)).run();
      }
      results.push({ endpoint: sub.endpoint, success: false, error: `HTTP ${statusCode ?? '?'}` });
    }
  }
  return results;
};
