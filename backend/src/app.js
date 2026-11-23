import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { CORS_ORIGIN, TRUST_PROXY } from './config/game.js';
import { APP_VERSION } from './config/version.js';
import buildRoutes from './routes/index.js';
import { UPLOAD_DIR } from './services/uploadService.js';

morgan.token('safe-url', (req) => String(req.originalUrl || '')
  .replace(/\/sessions\/[A-Za-z0-9]{6}(?=\/|\?|$)/g, '/sessions/<redacted>'));

function buildCorsOrigin() {
  const allowed = CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  return (origin, callback) => {
    callback(null, !origin || allowed.includes(origin));
  };
}

export default function createApp(gameService, ioNamespace) {
  const app = express();
  app.disable('x-powered-by');

  if (TRUST_PROXY) {
    app.set('trust proxy', /^\d+$/.test(TRUST_PROXY) ? Number(TRUST_PROXY) : TRUST_PROXY);
  }

  app.use(
    cors({
      origin: buildCorsOrigin(),
      credentials: false,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      maxAge: 600,
    })
  );
  app.use(
    helmet({
      hsts: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginEmbedderPolicy: false,
    })
  );
  if (process.env.NODE_ENV !== 'test') {
    app.use(morgan(
      process.env.NODE_ENV === 'production'
        ? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
        : ':method :safe-url :status :response-time ms - :res[content-length]'
    ));
  }
  app.use(express.json({ limit: '100kb' }));

  app.use(
    '/uploads',
    express.static(UPLOAD_DIR, {
      dotfiles: 'deny',
      index: false,
      fallthrough: false,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Cache-Control', 'public, max-age=3600');
      },
    })
  );

  app.get('/health', (_req, res) => {
    res.json({ ok: true, version: APP_VERSION });
  });

  app.use('/api', buildRoutes(gameService, ioNamespace));

  app.use((error, _req, res, _next) => {
    const requestedStatus = Number(error.status);
    const status = Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 600
      ? requestedStatus
      : 500;

    if (status >= 500) {
      console.error('Unhandled request error:', error);
    }

    res.status(status).json({
      error: status >= 500 ? 'Erreur interne du serveur' : (error.message || 'Requête invalide'),
    });
  });

  return app;
}
