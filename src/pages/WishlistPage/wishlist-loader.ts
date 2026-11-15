import type { LoaderFunction } from 'react-router';

import type { CategorySlug } from '@/features/films/categories';
import type { WishlistStorage } from '@/features/wishlist/wishlist-storage';
import { orBadGateway } from '@/lib/http-error';
import type { FilmSummary } from '@/types/film';
import type { FilmsApi } from '@/types/films-api';

export interface WishlistEntry {
  film: FilmSummary;
  category: CategorySlug | null;
}

export interface WishlistPageData {
  entries: WishlistEntry[];
}

/** Joins the cookie items (ids) with film data. Films TMDB no longer knows are skipped. */
export function createWishlistLoader(films: FilmsApi, storage: WishlistStorage): LoaderFunction {
  return async ({ request }): Promise<WishlistPageData> => {
    const items = storage.read(request);
    if (items.length === 0) {
      return { entries: [] };
    }

    const found = await orBadGateway(() =>
      films.getFilms(
        items.map((item) => item.filmId),
        request.signal,
      ),
    );
    const filmsById = new Map(found.map((film) => [film.id, film]));

    return {
      entries: items.flatMap((item) => {
        const film = filmsById.get(item.filmId);
        return film ? [{ film, category: item.category }] : [];
      }),
    };
  };
}
