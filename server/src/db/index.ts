import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema.js';
import { env, dbPath, uploadsDir } from '../lib/env.js';

fs.mkdirSync(env.dataDir, { recursive: true });
fs.mkdirSync(uploadsDir, { recursive: true });

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');
sqlite.pragma('busy_timeout = 5000');

export const db = drizzle(sqlite, { schema });

export function runMigrations() {
  // drizzle/ sits next to package.json; cwd is the server dir both locally and under PM2
  const migrationsFolder = path.resolve('drizzle');
  migrate(db, { migrationsFolder });
}

export { schema };
