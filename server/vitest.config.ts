import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./test/setup.ts'],
    fileParallelism: false, // one shared SQLite per run; files run sequentially
    testTimeout: 15000,
  },
});
