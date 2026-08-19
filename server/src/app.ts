import express from 'express';
import { authRouter } from './routes/auth.js';
import { projelerRouter } from './routes/projeler.js';
import { notlarRouter } from './routes/notlar.js';
import { dosyalarRouter } from './routes/dosyalar.js';
import { hatirlaticilarRouter } from './routes/hatirlaticilar.js';
import { pushRouter } from './routes/push.js';
import { digestRouter } from './routes/digest.js';
import { ceklerRouter } from './routes/cekler.js';
import { hakedislerRouter } from './routes/hakedisler.js';
import { belgelerRouter } from './routes/belgeler.js';
import { malzemelerRouter } from './routes/malzemeler.js';
import { taseronlarRouter } from './routes/taseronlar.js';
import { requireAuth } from './middleware/auth.js';
import { requireAuthOrDeviceToken, type Scope } from './middleware/deviceToken.js';
import { searchRouter } from './routes/search.js';
import { deviceTokensRouter } from './routes/deviceTokens.js';

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

  // capture endpoints: session OR scoped device token (iOS Shortcuts), but ONLY for create
  const captureAuth = (scope: Scope): express.RequestHandler => (req, res, next) => {
    const mw = req.method === 'POST' && req.path === '/' ? requireAuthOrDeviceToken(scope) : requireAuth;
    mw(req, res, next);
  };

  // everything below requires a session
  app.use('/api/projeler', requireAuth, projelerRouter);
  app.use('/api/notlar', captureAuth('notes:write'), notlarRouter);
  app.use('/api/dosyalar', requireAuth, dosyalarRouter);
  app.use('/api/hatirlaticilar', captureAuth('reminders:write'), hatirlaticilarRouter);
  app.use('/api/push', requireAuth, pushRouter);
  app.use('/api/digest', requireAuth, digestRouter);
  app.use('/api/cekler', requireAuth, ceklerRouter);
  app.use('/api/hakedisler', requireAuth, hakedislerRouter);
  app.use('/api/belgeler', requireAuth, belgelerRouter);
  app.use('/api/malzemeler', requireAuth, malzemelerRouter);
  app.use('/api/taseronlar', requireAuth, taseronlarRouter);
  app.use('/api/search', requireAuth, searchRouter);
  app.use('/api/device-tokens', requireAuth, deviceTokensRouter);

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
