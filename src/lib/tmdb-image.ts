const IMAGE_BASE_URL = 'https://image.tmdb.org/t/p';

/** Widths TMDB serves for each image kind (https://developer.themoviedb.org/docs/image-basics). */
const WIDTHS = {
  poster: [185, 342, 500, 780],
  backdrop: [300, 780, 1280],
  profile: [185],
} as const;

export type TmdbImageKind = keyof typeof WIDTHS;

export interface TmdbImageSources {
  src: string;
  srcSet: string;
}

const FALLBACK_WIDTH = 500;

function imageUrl(path: string, width: number): string {
  return `${IMAGE_BASE_URL}/w${String(width)}${path}`;
}

/** `src` (a mid-size fallback) and `srcSet` for a TMDB image path such as `/abc.jpg`. */
export function tmdbImage(path: string, kind: TmdbImageKind): TmdbImageSources {
  const widths: readonly number[] = WIDTHS[kind];
  const fallbackWidth = widths[Math.floor((widths.length - 1) / 2)] ?? FALLBACK_WIDTH;

  return {
    src: imageUrl(path, fallbackWidth),
    srcSet: widths.map((width) => `${imageUrl(path, width)} ${String(width)}w`).join(', '),
  };
}

/** The largest variant, for Open Graph previews. */
export function tmdbImageUrl(path: string, kind: TmdbImageKind): string {
  const widths: readonly number[] = WIDTHS[kind];
  return imageUrl(path, widths.at(-1) ?? FALLBACK_WIDTH);
}
