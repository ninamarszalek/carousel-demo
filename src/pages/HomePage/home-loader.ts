import type { LoaderFunction } from 'react-router';

import { CATEGORIES, type Category } from '@/features/films/categories';
import { httpError } from '@/lib/http-error';
import type { FilmSummary } from '@/types/film';
import { FilmServiceError, type FilmsApi } from '@/types/films-api';

export type CategoryRow =
  | { category: Category; status: 'ok'; films: FilmSummary[] }
  | { category: Category; status: 'error' };

export interface HomeData {
  rows: CategoryRow[];
}

/**
 * Loads every category in parallel. One failing category does not break the page: its row shows
 * an error with a retry link. Only when all of them fail does the page become a 502.
 */
export function createHomeLoader(films: FilmsApi): LoaderFunction {
  return async ({ request }): Promise<HomeData> => {
    const rows = await Promise.all(
      CATEGORIES.map(async (category): Promise<CategoryRow> => {
        try {
          const categoryFilms = await films.getFilmsByGenre(category.genreId, request.signal);
          return { category, status: 'ok', films: categoryFilms };
        } catch (error) {
          // A failing film service is shown in the row; anything else is a bug.
          if (!(error instanceof FilmServiceError)) {
            throw error;
          }
          return { category, status: 'error' };
        }
      }),
    );

    if (rows.every((row) => row.status === 'error')) {
      httpError(502, "Couldn't load films. Please try again in a moment.");
    }
    return { rows };
  };
}
