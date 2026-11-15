export type CategorySlug = 'action' | 'comedy' | 'horror';

export interface Category {
  slug: CategorySlug;
  label: string;
  /** TMDB genre id: https://developer.themoviedb.org/reference/genre-movie-list */
  genreId: number;
}

/**
 * The number of steps in each category's background gradient. Keep in sync with the length of
 * `$blob-layouts` in src/styles/themes/_categories.scss, where the steps are defined.
 */
const GRADIENT_STEPS = 4;

/** The gradient step shown while the film at `activeIndex` is in front. */
export function gradientStep(activeIndex: number): number {
  return activeIndex % GRADIENT_STEPS;
}

/** The homepage carousels, in display order. The order also decides `resolveCategory()` ties. */
export const CATEGORIES: readonly Category[] = [
  { slug: 'action', label: 'Action', genreId: 28 },
  { slug: 'comedy', label: 'Comedy', genreId: 35 },
  { slug: 'horror', label: 'Horror', genreId: 27 },
];

export function isCategorySlug(value: unknown): value is CategorySlug {
  return CATEGORIES.some((category) => category.slug === value);
}

export function getCategory(slug: CategorySlug): Category {
  const category = CATEGORIES.find((item) => item.slug === slug);
  if (!category) {
    throw new Error(`Unknown category "${slug}".`);
  }
  return category;
}

/**
 * The category a film page is shown in:
 * 1. the category from the URL (the carousel the film was opened from), if it is valid,
 * 2. otherwise the first category, in carousel order, that matches one of the film's genres,
 * 3. otherwise `null`: the default look.
 */
export function resolveCategory(
  param: string | null,
  genreIds: readonly number[],
): CategorySlug | null {
  if (isCategorySlug(param)) {
    return param;
  }
  return CATEGORIES.find((category) => genreIds.includes(category.genreId))?.slug ?? null;
}

/** The URL of a film page, opened in the given category. */
export function filmPath(filmId: number, category: CategorySlug | null = null): string {
  const path = `/film/${String(filmId)}`;
  return category ? `${path}?category=${category}` : path;
}
