import express from 'express';
import { http, HttpResponse } from 'msw';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { FilmDetails, FilmSummary } from '@/types/film';
import { MAX_FILMS_PER_REQUEST } from '@/types/films-api';

import { GENRE_IDS, UNKNOWN_FILM_ID } from '../../tests/mocks/tmdb/fixtures';
import { TMDB_TEST_BASE_URL, TMDB_TEST_TOKEN } from '../../tests/mocks/tmdb/handlers';
import { setupTmdbServer } from '../../tests/mocks/tmdb/setup-tmdb-server';
import { createCache } from '../tmdb/cache';
import { createTmdbClient } from '../tmdb/client';
import { createTmdbFilmsApi } from '../tmdb/films-service';
import { createApiRouter } from './router';

const server = setupTmdbServer();

/** The real API stack (router → service → client) with TMDB answered by MSW. */
function createTestApp() {
  const client = createTmdbClient({ baseUrl: TMDB_TEST_BASE_URL, accessToken: TMDB_TEST_TOKEN });
  return express().use('/api', createApiRouter(createTmdbFilmsApi(client, createCache())));
}

describe('API router', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('GET /api/genres/:id/films', () => {
    it('returns the films of a genre as domain models, cacheable for 5 minutes', async () => {
      const response = await request(createTestApp()).get(
        `/api/genres/${String(GENRE_IDS.horror)}/films`,
      );

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=300');
      const films = response.body as FilmSummary[];
      expect(films).toHaveLength(3);
      expect(films[0]).toStrictEqual({
        id: 419430,
        title: 'Get Out',
        posterPath: '/poster-419430.jpg',
        releaseYear: 2017,
        rating: 7.6,
        genreIds: [9648, 53, 27],
      });
    });

    it.each(['abc', '0', '-1', '1.5'])('rejects an invalid genre id (%s)', async (id) => {
      const response = await request(createTestApp()).get(`/api/genres/${id}/films`);

      expect(response.status).toBe(400);
      expect(response.body).toStrictEqual({ error: 'Invalid genre id' });
    });
  });

  describe('GET /api/films/:id', () => {
    it('returns the film details, cacheable for an hour', async () => {
      const response = await request(createTestApp()).get('/api/films/603');

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('public, max-age=3600');
      expect(response.body as FilmDetails).toMatchObject({
        id: 603,
        title: 'The Matrix',
        runtimeMinutes: 136,
      });
    });

    it('returns 404 for an unknown film', async () => {
      const response = await request(createTestApp()).get(`/api/films/${String(UNKNOWN_FILM_ID)}`);

      expect(response.status).toBe(404);
      expect(response.body).toStrictEqual({ error: 'Film not found' });
    });

    it('returns 400 for an invalid id', async () => {
      expect((await request(createTestApp()).get('/api/films/007')).status).toBe(400);
    });
  });

  describe('GET /api/films?ids=', () => {
    it('returns the known films in the requested order', async () => {
      const response = await request(createTestApp()).get(
        `/api/films?ids=419430,${String(UNKNOWN_FILM_ID)},603`,
      );

      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('private, max-age=60');
      expect((response.body as FilmSummary[]).map((film) => film.id)).toStrictEqual([419430, 603]);
    });

    it.each([
      ['missing', ''],
      ['empty', '?ids='],
      ['malformed', '?ids=1,abc'],
      [
        'too many',
        `?ids=${Array.from({ length: MAX_FILMS_PER_REQUEST + 1 }, () => '1').join(',')}`,
      ],
    ])('rejects a %s id list', async (_name, query) => {
      expect((await request(createTestApp()).get(`/api/films${query}`)).status).toBe(400);
    });
  });

  it('answers 502 when TMDB fails, without leaking details', async () => {
    server.use(http.get(`${TMDB_TEST_BASE_URL}/*`, () => new HttpResponse(null, { status: 500 })));

    const response = await request(createTestApp()).get('/api/films/603');

    expect(response.status).toBe(502);
    expect(response.body).toStrictEqual({
      error: 'The film service is unavailable. Please try again later.',
    });
  });

  it('answers 500 JSON for unexpected errors', async () => {
    const app = express().use(
      '/api',
      createApiRouter({
        getFilmsByGenre: () => Promise.reject(new Error('bug')),
        getFilm: () => Promise.resolve(null),
        getFilms: () => Promise.resolve([]),
      }),
    );

    const response = await request(app).get('/api/genres/28/films');

    expect(response.status).toBe(500);
    expect(response.body).toStrictEqual({ error: 'Internal Server Error' });
  });

  it('returns JSON 404 for unknown API routes', async () => {
    const response = await request(createTestApp()).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toStrictEqual({ error: 'Not found' });
  });
});
