import express, { type ErrorRequestHandler, type Express, type RequestHandler } from 'express';
import helmet from 'helmet';

import type { FilmsApi } from '@/types/films-api';

import { createApiRouter } from './api/router';
import { CONTENT_SECURITY_POLICY, cspNonce } from './csp';
import { createRenderHandler, type RenderOptions, type Renderer } from './render';

export type ServerMode = 'development' | 'production';

export interface AppOptions {
  mode: ServerMode;
  renderer: Renderer;
  /** Server-side data access (TMDB), shared by the `/api` routes and SSR. */
  films: FilmsApi;
  /** Page rendering options; `films` comes from above. Tests use it to shorten the timeout. */
  renderOptions?: Omit<RenderOptions, 'films'>;
  /** Mode-specific middleware that runs before SSR: Vite dev middleware, or compression + static assets. */
  middleware?: readonly RequestHandler[];
}

export function createApp({
  mode,
  renderer,
  films,
  renderOptions = {},
  middleware = [],
}: AppOptions): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cspNonce);
  app.use(
    helmet({
      contentSecurityPolicy: mode === 'production' ? CONTENT_SECURITY_POLICY : false,
    }),
  );

  app.get('/healthz', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api', createApiRouter(films));

  for (const handler of middleware) {
    app.use(handler);
  }

  app.use(createRenderHandler(renderer, { ...renderOptions, films }));
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
