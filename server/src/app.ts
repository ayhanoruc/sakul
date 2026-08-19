import express from 'express';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // Health check — used by the PWA shell and by ops
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString(),
    });
  });

  return app;
}
