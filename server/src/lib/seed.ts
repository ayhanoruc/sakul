import { db, schema } from '../db/index.js';
import { hashPassword } from './auth.js';
import { env } from './env.js';

/** One-time seed: creates the single user from env if the table is empty. */
export async function seedAdminUser() {
  const existing = db.query.users.findFirst().sync();
  if (existing) return;
  if (!env.adminUsername || !env.adminPassword) {
    console.warn('users table empty and ADMIN_USERNAME/ADMIN_PASSWORD not set — no one can log in');
    return;
  }
  db.insert(schema.users)
    .values({
      username: env.adminUsername,
      passwordHash: await hashPassword(env.adminPassword),
      displayName: env.adminUsername,
    })
    .run();
  console.log(`seeded user "${env.adminUsername}"`);
}
