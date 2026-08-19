import path from 'node:path';

/** All config in one place. Production values come from /var/www/sakul/shared/.env */
export const env = {
  port: Number(process.env.PORT ?? 3002),
  isProd: process.env.NODE_ENV === 'production',
  /** DB + uploads live here — OUTSIDE the git checkout in production. */
  dataDir: path.resolve(process.env.DATA_DIR ?? 'data'),
  /** One-time seed for the single user; ignored once a user exists. */
  adminUsername: process.env.ADMIN_USERNAME,
  adminPassword: process.env.ADMIN_PASSWORD,
};

export const dbPath = path.join(env.dataDir, 'sakul.db');
export const uploadsDir = path.join(env.dataDir, 'uploads');
