import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { MAX_FILMS_PER_REQUEST } from '@/types/films-api';

import { GENRE_IDS, MULTI_GENRE_FILM_ID, UNKNOWN_FILM_ID } from '../../tests/mocks/tmdb/fixtures';
import { TMDB_TEST_BASE_URL, TMDB_TEST_TOKEN } from '../../tests/mocks/tmdb/handlers';
import { setupTmdbServer } from '../../tests/mocks/tmdb/setup-tmdb-server';
import { createCache } from './cache';
import { createTmdbClient } from './client';
import { createTmdbFilmsApi } from './films-service';

const server = setupTmdbServer();

function createApi() {
  const client = createTmdbClient({ baseUrl: TMDB_TEST_BASE_URL, accessToken: TMDB_TEST_TOKEN });
  return createTmdbFilmsApi(client, createCache());
}

/** Counts TMDB calls while still answering them from the fixtures. */
function countTmdbCalls() {
  const calls: string[] = [];
  server.events.on('request:start', ({ request }) => {
    calls.push(new URL(request.url).pathname);
  });
  return calls;
}

describe('createTmdbFilmsApi', () => {
  it('loads the popular films of a genre', async () => {
    const films = await createApi().getFilmsByGenre(GENRE_IDS.horror);

    expect(films.map((film) => film.title)).toStrictEqual(['Get Out', 'The Shining', 'Hereditary']);
  });

  it('asks TMDB for popular, well-known, non-adult films of the genre', async () => {
    let params: URLSearchParams | undefined;
    server.use(
      http.get(`${TMDB_TEST_BASE_URL}/discover/movie`, ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ page: 1, results: [] });
      }),
    );

    await createApi().getFilmsByGenre(GENRE_IDS.comedy);

    expect(Object.fromEntries(params ?? [])).toMatchObject({
      with_genres: '35',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': '100',
    });
  });

  it('loads film details, and null for an unknown film', async () => {
    const api = createApi();

    await expect(api.getFilm(603)).resolves.toMatchObject({ title: 'The Matrix' });
    await expect(api.getFilm(UNKNOWN_FILM_ID)).resolves.toBeNull();
  });

  it('caches results, including unknown films', async () => {
    const api = createApi();
    const calls = countTmdbCalls();

    await api.getFilmsByGenre(GENRE_IDS.action);
    await api.getFilmsByGenre(GENRE_IDS.action);
    await api.getFilm(UNKNOWN_FILM_ID);
    await api.getFilm(UNKNOWN_FILM_ID);

    expect(calls).toStrictEqual(['/3/discover/movie', `/3/movie/${String(UNKNOWN_FILM_ID)}`]);
  });

  it('loads several films for the wish list, skipping unknown ones and keeping the order', async () => {
    const films = await createApi().getFilms([419430, UNKNOWN_FILM_ID, 603, 419430]);

    expect(films.map((film) => film.id)).toStrictEqual([419430, 603]);
    expect(films[0]?.genreIds).toStrictEqual([9648, 53, 27]);
  });

  it('shares film details between the detail page and the wish list', async () => {
    const api = createApi();
    const calls = countTmdbCalls();

    await api.getFilm(MULTI_GENRE_FILM_ID);
    await api.getFilms([MULTI_GENRE_FILM_ID]);

    expect(calls).toHaveLength(1);
  });

  it('rejects too many ids at once', async () => {
    const ids = Array.from({ length: MAX_FILMS_PER_REQUEST + 1 }, (_, index) => index + 1);

    await expect(createApi().getFilms(ids)).rejects.toThrow(RangeError);
  });
});
