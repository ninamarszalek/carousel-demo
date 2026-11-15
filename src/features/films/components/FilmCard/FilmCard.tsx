import { Link } from 'react-router';

import type { FilmSummary } from '@/types/film';

import { filmPath, type CategorySlug } from '../../categories';
import { FilmPoster } from '../FilmPoster';

import './_film-card.scss';

interface FilmCardProps {
  film: FilmSummary;
  /** The category the card is shown in; the film page opens in it. */
  category: CategorySlug | null;
  priority?: boolean;
}

/** A poster with the title and year, linking to the film page. */
export function FilmCard({ film, category, priority = false }: FilmCardProps) {
  return (
    <article className="film-card">
      <Link className="film-card__link" to={filmPath(film.id, category)}>
        <FilmPoster
          path={film.posterPath}
          title={film.title}
          sizes="(width >= 48rem) 12rem, 40vw"
          priority={priority}
        />
        <h3 className="film-card__title">{film.title}</h3>
      </Link>
      {film.releaseYear !== null && <p className="film-card__meta">{film.releaseYear}</p>}
    </article>
  );
}
