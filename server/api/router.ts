import { Router } from 'express';

/**
 * Backend-for-frontend API. The browser talks only to these endpoints, so the TMDB token stays on
 * the server. TMDB proxy routes are added together with the TMDB integration.
 */
export function createApiRouter(): Router {
  const router = Router();

  router.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });

  return router;
}
