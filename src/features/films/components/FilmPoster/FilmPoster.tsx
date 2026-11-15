import { TmdbImage } from '../TmdbImage';

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

  return (
    <TmdbImage
      className="film-poster"
      path={path}
      kind="poster"
      alt={`Poster of ${title}`}
      sizes={sizes}
      width={500}
      height={750}
      priority={priority}
    />
  );
}
