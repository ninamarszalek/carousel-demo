import type { LoaderFunction } from 'react-router';

import { CATEGORIES, type Category } from '@/features/films/categories';
import { badGateway } from '@/lib/http-error';
import type { FilmSummary } from '@/types/film';
import { FilmServiceError, type FilmsApi } from '@/types/films-api';

/** A homepage carousel: its category and its films, as far as they have been loaded. */
export type CategoryRow =
  /** Loaded: always the case on the server, so the HTML and the hydration data are complete. */
  | { category: Category; status: 'loaded'; films: FilmSummary[] }
  /** Still loading (browser only): the page shows a skeleton until the promise settles. */
  | { category: Category; status: 'pending'; films: Promise<FilmSummary[]> }
  /** Loading failed on the server: the page shows an inline error in this row. */
  | { category: Category; status: 'failed' };

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
          const pendingFilms = films.getFilmsByGenre(category.genreId, request.signal);
          // <Await> handles the rejection; this only stops an "unhandled rejection" report when
          // the user navigates away before the row is rendered.
          pendingFilms.catch(() => undefined);
          return { category, status: 'pending', films: pendingFilms };
        }),
      };
    }

    // One failing category does not break the page: its row shows an inline error. Only when
    // all of them fail does the page become a 502.
    const rows = await Promise.all(
      CATEGORIES.map(async (category): Promise<CategoryRow> => {
        try {
          const loaded = await films.getFilmsByGenre(category.genreId, request.signal);
          return { category, status: 'loaded', films: loaded };
        } catch (error) {
          if (!(error instanceof FilmServiceError)) {
            throw error;
          }
          return { category, status: 'failed' };
        }
      }),
    );

    if (rows.every((row) => row.status === 'failed')) {
      badGateway();
    }
    return { rows };
  };
}
