import { Router, type ErrorRequestHandler, type Response } from 'express';

import { MAX_FILMS_PER_REQUEST, parseId, type FilmsApi } from '@/types/films-api';

import { TmdbError } from '../tmdb/client';

const FIVE_MINUTES = 300;
const ONE_HOUR = 3600;

/**
 * Backend-for-frontend API. The browser talks only to these endpoints, so the TMDB token stays on
 * the server. Responses are domain models (`src/types/film.ts`), not raw TMDB data.
 */
export function createApiRouter(films: FilmsApi): Router {
  const router = Router();

  router.get('/genres/:id/films', async (req, res) => {
    const genreId = parseId(req.params.id);
    if (genreId === null) {
      sendError(res, 400, 'Invalid genre id');
      return;
    }

    const result = await films.getFilmsByGenre(genreId);
    res.set('Cache-Control', `public, max-age=${String(FIVE_MINUTES)}`).json(result);
  });

  router.get('/films/:id', async (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) {
      sendError(res, 400, 'Invalid film id');
      return;
    }

    const film = await films.getFilm(id);
    if (!film) {
      sendError(res, 404, 'Film not found');
      return;
    }
    res.set('Cache-Control', `public, max-age=${String(ONE_HOUR)}`).json(film);
  });

  router.get('/films', async (req, res) => {
    const ids = parseIdList(req.query.ids);
    if (!ids) {
      sendError(res, 400, `Expected ?ids= with 1–${String(MAX_FILMS_PER_REQUEST)} film ids`);
      return;
    }

    const result = await films.getFilms(ids);
    res.set('Cache-Control', 'private, max-age=60').json(result);
  });

  router.use((_req, res) => {
    sendError(res, 404, 'Not found');
  });

  router.use(apiErrorHandler);

  return router;
}

/** `?ids=1,2,3` → `[1, 2, 3]`; `null` when missing, malformed or too long. */
function parseIdList(value: unknown): number[] | null {
  if (typeof value !== 'string' || value === '') {
    return null;
  }
  const parts = value.split(',');
  if (parts.length > MAX_FILMS_PER_REQUEST) {
    return null;
  }
  const ids = parts.map(parseId);
  return ids.every((id) => id !== null) ? ids : null;
}

function sendError(res: Response, status: number, message: string): void {
  res.status(status).json({ error: message });
}

/** API errors are JSON too; TMDB failures become 502 Bad Gateway. */
const apiErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof TmdbError) {
    console.error('[api] TMDB error:', error.message);
    sendError(res, 502, 'The film service is unavailable. Please try again later.');
    return;
  }

  console.error('[api] unhandled error:', error);
  sendError(res, 500, 'Internal Server Error');
};
