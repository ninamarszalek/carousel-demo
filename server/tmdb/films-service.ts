import type { FilmDetails } from '@/types/film';
import { MAX_FILMS_PER_REQUEST, type FilmsApi } from '@/types/films-api';

import type { Cache } from './cache';
import type { TmdbClient } from './client';
import type { TmdbMovieDetails, TmdbMovieListItem, TmdbPagedResponse } from './dto';
import { detailsToSummary, toFilmDetails, toFilmSummary } from './mappers';

const MINUTE = 60_000;

/** How long each kind of data is cached. Lists change daily, film details almost never. */
export const CACHE_TTL_MS = {
  genreList: 10 * MINUTE,
  film: 60 * MINUTE,
  /** Unknown ids are cached too, so repeated requests for them do not reach TMDB. */
  missingFilm: 10 * MINUTE,
} as const;

/** Only well-known films, so the carousels are not full of obscure titles without posters. */
const MIN_VOTE_COUNT = '100';

/**
 * The server-side `FilmsApi`: calls TMDB through the cache.
 *
 * Callers' abort signals are not passed to TMDB: one load can be shared by several requests
 * (in-flight de-duplication), so one client going away must not fail the others. The TMDB client
 * has its own timeout, and a finished load still warms the cache.
 */
export function createTmdbFilmsApi(client: TmdbClient, cache: Cache): FilmsApi {
  function getFilm(id: number): Promise<FilmDetails | null> {
    const ttl = (film: FilmDetails | null) => (film ? CACHE_TTL_MS.film : CACHE_TTL_MS.missingFilm);
    return cache.getOrLoad(`film:${String(id)}`, ttl, async () => {
      const movie = await client.get<TmdbMovieDetails>(`/movie/${String(id)}`, {
        append_to_response: 'credits',
      });
      return movie ? toFilmDetails(movie) : null;
    });
  }

  return {
    getFilmsByGenre(genreId) {
      return cache.getOrLoad(`genre:${String(genreId)}`, CACHE_TTL_MS.genreList, async () => {
        const page = await client.get<TmdbPagedResponse<TmdbMovieListItem>>('/discover/movie', {
          with_genres: String(genreId),
          sort_by: 'popularity.desc',
          include_adult: 'false',
          'vote_count.gte': MIN_VOTE_COUNT,
          page: '1',
        });
        return (page?.results ?? []).map(toFilmSummary);
      });
    },

    getFilm,

    async getFilms(ids) {
      if (ids.length > MAX_FILMS_PER_REQUEST) {
        throw new RangeError(`Too many ids: at most ${String(MAX_FILMS_PER_REQUEST)} are allowed.`);
      }
      const films = await Promise.all([...new Set(ids)].map(getFilm));
      return films.filter((film) => film !== null).map(detailsToSummary);
    },
  };
}
