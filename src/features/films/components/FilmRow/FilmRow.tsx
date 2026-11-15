import type { FilmSummary } from '@/types/film';

import type { CategorySlug } from '../../categories';
import { FilmCard } from '../FilmCard';

import './_film-row.scss';

interface FilmRowProps {
  films: readonly FilmSummary[];
  category: CategorySlug;
  /** The id of the heading that names this row. */
  labelledBy: string;
  /** Load the first posters eagerly (the row is above the fold). */
  priority?: boolean;
}

/** About how many posters fit on a wide screen. */
const EAGER_POSTERS = 6;

/**
 * A horizontally scrolling row of film cards. A plain list that works without JavaScript; the
 * carousel spec builds the interactive carousel on top of it.
 */
export function FilmRow({ films, category, labelledBy, priority = false }: FilmRowProps) {
  return (
    // A scrollable region must be focusable so keyboard users can scroll it.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
    <ul className="film-row" aria-labelledby={labelledBy} tabIndex={0}>
      {films.map((film, index) => (
        <li key={film.id} className="film-row__item">
          <FilmCard film={film} category={category} priority={priority && index < EAGER_POSTERS} />
        </li>
      ))}
    </ul>
  );
}
