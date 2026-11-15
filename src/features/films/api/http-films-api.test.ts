import { describe, expect, it, vi } from 'vitest';

import { FilmServiceError } from '@/types/films-api';

import { createHttpFilmsApi } from './http-films-api';

/** A fetch that answers every call with a fresh response from `respond` (or rejects with it). */
function fakeFetch(respond: () => Response) {
  return vi.fn<typeof fetch>(() => Promise.resolve(respond()));
}

function failingFetch(error: Error) {
  return vi.fn<typeof fetch>(() => Promise.reject(error));
}

describe('createHttpFilmsApi', () => {
  it('calls the BFF endpoints', async () => {
    const fetchImpl = fakeFetch(() => Response.json([]));
    const api = createHttpFilmsApi(fetchImpl);

    await api.getFilmsByGenre(28);
    await api.getFilm(603);
    await api.getFilms([1, 2]);

    expect(fetchImpl.mock.calls.map(([url]) => url)).toStrictEqual([
      '/api/genres/28/films',
      '/api/films/603',
      '/api/films?ids=1,2',
    ]);
  });

  it('does not call the API for an empty wish list', async () => {
    const fetchImpl = fakeFetch(() => Response.json([]));

    await expect(createHttpFilmsApi(fetchImpl).getFilms([])).resolves.toStrictEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('returns null for an unknown film', async () => {
    const api = createHttpFilmsApi(fakeFetch(() => new Response(null, { status: 404 })));

    await expect(api.getFilm(1)).resolves.toBeNull();
  });

  it('throws a FilmServiceError with the status for failed responses', async () => {
    const api = createHttpFilmsApi(fakeFetch(() => new Response(null, { status: 502 })));

    await expect(api.getFilm(1)).rejects.toThrow(FilmServiceError);
    await expect(api.getFilm(1)).rejects.toMatchObject({ status: 502 });
  });

  it('throws a FilmServiceError for network errors', async () => {
    const api = createHttpFilmsApi(failingFetch(new TypeError('Failed to fetch')));

    await expect(api.getFilmsByGenre(28)).rejects.toThrow(FilmServiceError);
  });

  it('lets an aborted navigation surface as an abort, not a service error', async () => {
    const controller = new AbortController();
    controller.abort();
    const abortError = new DOMException('Aborted', 'AbortError');
    const api = createHttpFilmsApi(failingFetch(abortError));

    await expect(api.getFilm(1, controller.signal)).rejects.toBe(abortError);
  });
});
