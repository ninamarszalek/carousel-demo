import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';

import { createApiRouter } from './api/router';
import { createRenderHandler, type Renderer } from './render';

export type ServerMode = 'development' | 'production';

export interface AppOptions {
  mode: ServerMode;
  renderer: Renderer;
  /** Mode-specific middleware that runs before SSR: Vite dev middleware, or compression + static assets. */
  middleware?: readonly RequestHandler[];
}

/** Content Security Policy for production. Dev is excluded because Vite injects inline scripts for HMR. */
const CONTENT_SECURITY_POLICY = {
  directives: {
    'img-src': ["'self'", 'data:', 'https://image.tmdb.org'],
    // HTTPS is the job of the reverse proxy; upgrading requests would break plain-HTTP runs on a LAN IP.
    'upgrade-insecure-requests': null,
  },
};

export function createApp({ mode, renderer, middleware = [] }: AppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: mode === 'production' ? CONTENT_SECURITY_POLICY : false,
    }),
  );

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', createApiRouter());

  for (const handler of middleware) {
    app.use(handler);
  }

  app.use(createRenderHandler(renderer));
  app.use(errorHandler);

  return app;
}

const errorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  console.error('[server] unhandled error:', error);

  if (res.headersSent) {
    next(error);
    return;
  }

  res.status(500).type('text/plain').send('Internal Server Error');
};
