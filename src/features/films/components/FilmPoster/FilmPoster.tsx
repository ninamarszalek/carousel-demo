import { tmdbImage } from '@/lib/tmdb-image';

import './_film-poster.scss';

interface FilmPosterProps {
  path: string | null;
  title: string;
  /** The `sizes` attribute: how wide the poster is rendered. */
  sizes: string;
  /** Above-the-fold posters load eagerly; the rest lazily. */
  priority?: boolean;
}

/** A 2:3 film poster, or a placeholder with the title when TMDB has no poster. */
export function FilmPoster({ path, title, sizes, priority = false }: FilmPosterProps) {
  if (!path) {
    return (
      <div
        className="film-poster film-poster--empty"
        role="img"
        aria-label={`${title} (no poster)`}
      >
        <span className="film-poster__fallback-title" aria-hidden="true">
          {title}
        </span>
      </div>
    );
  }

  const { src, srcSet } = tmdbImage(path, 'poster');
  return (
    <img
      className="film-poster"
      src={src}
      srcSet={srcSet}
      sizes={sizes}
      alt={`Poster of ${title}`}
      width={500}
      height={750}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
    />
  );
}
