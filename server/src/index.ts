import { createApp } from './app.js';
import { runMigrations } from './db/index.js';
import { seedAdminUser } from './lib/seed.js';
import { env } from './lib/env.js';

runMigrations();
await seedAdminUser();

const app = createApp();
app.listen(env.port, '127.0.0.1', () => {
  console.log(`sakul-api listening on 127.0.0.1:${env.port}`);
});
