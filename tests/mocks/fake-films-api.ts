import type { FilmsApi } from '@/types/films-api';

import { detailsToSummary, toFilmDetails, toFilmSummary } from '../../server/tmdb/mappers';
import { discoverByGenre, movieDetails } from './tmdb/fixtures';

/**
 * An in-memory `FilmsApi` over the TMDB fixtures, mapped with the real mappers. Component and SSR
 * tests use it instead of the network; `overrides` simulate failures.
 */
export function createFakeFilmsApi(overrides: Partial<FilmsApi> = {}): FilmsApi {
  const getFilm: FilmsApi['getFilm'] = (id) => {
    const movie = movieDetails[id];
    return Promise.resolve(movie ? toFilmDetails(movie) : null);
  };

  return {
    getFilmsByGenre: (genreId) =>
      Promise.resolve((discoverByGenre[genreId]?.results ?? []).map(toFilmSummary)),
    getFilm,
    getFilms: async (ids) => {
      const films = await Promise.all(ids.map((id) => getFilm(id)));
      return films.filter((film) => film !== null).map(detailsToSummary);
    },
    ...overrides,
  };
}
