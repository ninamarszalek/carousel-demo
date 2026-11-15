import type { FilmDetails, FilmSummary } from './film';

/**
 * Film data access used by route loaders. It has two implementations:
 * - on the server it calls TMDB directly (`server/tmdb/films-service.ts`),
 * - in the browser it calls our `/api` endpoints (`src/features/films/api/http-films-api.ts`).
 * Loaders depend only on this interface, so they run unchanged on both sides.
 */
export interface FilmsApi {
  /** The most popular films of a TMDB genre (one page, up to 20 films). */
  getFilmsByGenre: (genreId: number, signal?: AbortSignal) => Promise<FilmSummary[]>;
  /** `null` when the film does not exist. */
  getFilm: (id: number, signal?: AbortSignal) => Promise<FilmDetails | null>;
  /** Unknown ids are skipped; the order of `ids` is kept. */
  getFilms: (ids: readonly number[], signal?: AbortSignal) => Promise<FilmSummary[]>;
}

/** The most ids `getFilms()` accepts in one call. */
export const MAX_FILMS_PER_REQUEST = 50;

/**
 * Parses a film or genre id from a URL. Ids are positive integers written without signs, leading
 * zeros or exponents, so every id has exactly one URL. Returns `null` for anything else.
 */
export function parseId(value: string | null | undefined): number | null {
  if (!value || !/^[1-9]\d{0,9}$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

/**
 * The film service could not answer: TMDB (on the server) or our `/api` (in the browser) failed or
 * timed out. Loaders turn it into a 502 page; anything else is a bug and stays a 500.
 */
export class FilmServiceError extends Error {
  override readonly name: string = 'FilmServiceError';
  /** The upstream HTTP status, or `null` for network errors and timeouts. */
  readonly status: number | null;

  constructor(message: string, status: number | null, options?: ErrorOptions) {
    super(message, options);
    this.status = status;
  }
}
