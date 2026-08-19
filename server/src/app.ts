import express from 'express';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Health check — used by the PWA shell and by ops
  app.get('/api/saglik', (_req, res) => {
    res.json({
      durum: 'ok',
      surum: process.env.npm_package_version ?? '0.1.0',
      zaman: new Date().toISOString(),
    });
  });

  return app;
}
