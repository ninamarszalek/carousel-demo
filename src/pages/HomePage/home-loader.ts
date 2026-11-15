import type { LoaderFunction } from 'react-router';

import { CATEGORIES, type Category } from '@/features/films/categories';
import { httpError } from '@/lib/http-error';
import type { FilmSummary } from '@/types/film';
import { FilmServiceError, type FilmsApi } from '@/types/films-api';

export interface CategoryRow {
  category: Category;
  /**
   * - an array: loaded (always the case on the server),
   * - a promise: still loading (browser); the page shows a skeleton until it settles,
   * - `null`: loading failed on the server; the page shows an inline error.
   */
  films: FilmSummary[] | Promise<FilmSummary[]> | null;
}

export interface HomeData {
  rows: CategoryRow[];
}

export interface HomeLoaderOptions {
  /**
   * `true` in the browser: return the requests unawaited, so the page appears at once with
   * skeletons and each category fills in on its own. `false` on the server: wait, so the HTML
   * and the hydration data contain the films (promises cannot be serialized for hydration).
   */
  deferData: boolean;
}

export function createHomeLoader(
  films: FilmsApi,
  { deferData }: HomeLoaderOptions,
): LoaderFunction {
  return async ({ request }): Promise<HomeData> => {
    if (deferData) {
      return {
        rows: CATEGORIES.map((category) => {
          const request_ = films.getFilmsByGenre(category.genreId, request.signal);
          // <Await> handles the rejection; this only stops an "unhandled rejection" report when
          // the user navigates away before the row is rendered.
          request_.catch(() => undefined);
          return { category, films: request_ };
        }),
      };
    }

    // One failing category does not break the page: its row shows an inline error. Only when
    // all of them fail does the page become a 502.
    const rows = await Promise.all(
      CATEGORIES.map(async (category): Promise<CategoryRow> => {
        try {
          return { category, films: await films.getFilmsByGenre(category.genreId, request.signal) };
        } catch (error) {
          if (!(error instanceof FilmServiceError)) {
            throw error;
          }
          return { category, films: null };
        }
      }),
    );

    if (rows.every((row) => row.films === null)) {
      httpError(502, "Couldn't load films. Please try again in a moment.");
    }
    return { rows };
  };
}
