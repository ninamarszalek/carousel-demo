import type { LoaderFunction, ShouldRevalidateFunction } from 'react-router';

import { defineHead } from '@/app/head';
import { filmPath, resolveCategory, type CategorySlug } from '@/features/films/categories';
import { httpError, orBadGateway } from '@/lib/http-error';
import { tmdbImageUrl } from '@/lib/tmdb-image';
import type { FilmDetails } from '@/types/film';
import { parseId, type FilmsApi } from '@/types/films-api';

export interface FilmPageData {
  film: FilmDetails;
  /** Decides the look of the page (`data-category`); `null` for the default look. */
  category: CategorySlug | null;
}

export function createFilmLoader(films: FilmsApi): LoaderFunction {
  return async ({ params, request }): Promise<FilmPageData> => {
    const id = parseId(params.id);
    if (id === null) {
      httpError(404, 'Film not found');
    }

    const film = await orBadGateway(() => films.getFilm(id, request.signal));
    if (!film) {
      httpError(404, 'Film not found');
    }

    const categoryParam = new URL(request.url).searchParams.get('category');
    const category = resolveCategory(
      categoryParam,
      film.genres.map((genre) => genre.id),
    );
    return { film, category };
  };
}

/** Film data does not depend on the wish list, so wish list posts do not reload it. */
export const shouldRevalidateFilm: ShouldRevalidateFunction = ({
  formMethod,
  defaultShouldRevalidate,
}) => (formMethod ? false : defaultShouldRevalidate);

const DESCRIPTION_LENGTH = 160;

export const filmHandle = defineHead<FilmPageData>(({ film }) => {
  const image = film.backdropPath ?? film.posterPath;
  return {
    title: film.releaseYear ? `${film.title} (${String(film.releaseYear)})` : film.title,
    ...(film.overview && { description: truncate(film.overview, DESCRIPTION_LENGTH) }),
    image: image ? tmdbImageUrl(image, film.backdropPath ? 'backdrop' : 'poster') : null,
    // All `?category=` variants show the same film.
    canonicalPath: filmPath(film.id),
  };
});

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).trimEnd()}…`;
}
