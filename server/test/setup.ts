// Runs before every test file. Points the app at a throwaway data dir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sakul-test-'));
process.env.DATA_DIR = dir;
process.env.NODE_ENV = 'test';

const { runMigrations } = await import('../src/db/index.js');
runMigrations();
