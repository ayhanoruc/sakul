import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // local dev: Vite on 5173, API on 3002 — mirrors nginx in production
      '/api': 'http://127.0.0.1:3002',
    },
  },
});
