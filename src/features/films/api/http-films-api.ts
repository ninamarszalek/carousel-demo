import type { FilmDetails, FilmSummary } from '@/types/film';
import { FilmServiceError, type FilmsApi } from '@/types/films-api';

/**
 * The browser-side `FilmsApi`: calls our `/api` endpoints (the server adds the TMDB token).
 * Used by route loaders after hydration; on the first request the server loads the data itself.
 */
export function createHttpFilmsApi(fetchImpl: typeof fetch = fetch): FilmsApi {
  async function getJson<T>(path: string, signal?: AbortSignal): Promise<T | null> {
    let response: Response;
    try {
      response = await fetchImpl(path, {
        headers: { Accept: 'application/json' },
        ...(signal && { signal }),
      });
    } catch (error) {
      // A cancelled navigation is not a failure: let the router see the abort.
      if (signal?.aborted) {
        throw error;
      }
      throw new FilmServiceError(`Request failed: ${path}`, null, { cause: error });
    }

    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new FilmServiceError(
        `Request failed with ${String(response.status)}: ${path}`,
        response.status,
      );
    }
    return (await response.json()) as T;
  }

  return {
    async getFilmsByGenre(genreId, signal) {
      return (await getJson<FilmSummary[]>(`/api/genres/${String(genreId)}/films`, signal)) ?? [];
    },
    getFilm(id, signal) {
      return getJson<FilmDetails>(`/api/films/${String(id)}`, signal);
    },
    async getFilms(ids, signal) {
      if (ids.length === 0) {
        return [];
      }
      return (await getJson<FilmSummary[]>(`/api/films?ids=${ids.join(',')}`, signal)) ?? [];
    },
  };
}
