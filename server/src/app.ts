import express from 'express';
import { authRouter } from './routes/auth.js';
import { projelerRouter } from './routes/projeler.js';
import { notlarRouter } from './routes/notlar.js';
import { dosyalarRouter } from './routes/dosyalar.js';
import { requireAuth } from './middleware/auth.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind nginx
  app.use(express.json({ limit: '1mb' }));

  // Health check — used by the PWA shell and by ops
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      version: process.env.npm_package_version ?? '0.1.0',
      time: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRouter);

  // everything below requires a session
  app.use('/api/projeler', requireAuth, projelerRouter);
  app.use('/api/notlar', requireAuth, notlarRouter);
  app.use('/api/dosyalar', requireAuth, dosyalarRouter);

  // central error handler (multer size errors etc.)
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: 'file_too_large', maxBytes: 25 * 1024 * 1024 });
      return;
    }
    console.error(err);
    res.status(500).json({ error: 'internal' });
  });

  return app;
}
