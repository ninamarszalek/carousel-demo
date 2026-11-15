import { useLoaderData } from 'react-router';

import { FilmPoster } from '@/features/films/components/FilmPoster';
import { WishlistButton } from '@/features/wishlist/components/WishlistButton';
import { useWishlist } from '@/features/wishlist/use-wishlist';
import { hasItem } from '@/features/wishlist/wishlist-cookie';
import { formatRating, formatRuntime } from '@/lib/format';
import { tmdbImage } from '@/lib/tmdb-image';
import type { FilmDetails } from '@/types/film';

import type { FilmPageData } from './film-loader';
import { FilmInfo } from './FilmInfo';

import './_film-details-page.scss';

/**
 * Layout (requirements §2.2): the image on the left (wider column), the description and the wish
 * list button on the right, additional info below. `data-category` drives the category theme.
 */
export function FilmDetailsPage() {
  const { film, category } = useLoaderData<FilmPageData>();
  const isOnList = hasItem(useWishlist(), film.id);

  return (
    <article className="film-page" data-category={category ?? undefined}>
      <div className="film-page__media">
        <FilmImage film={film} />
      </div>

      <div className="film-page__summary">
        <h1 className="film-page__title">{film.title}</h1>
        {film.tagline && <p className="film-page__tagline">{film.tagline}</p>}
        <FilmFacts film={film} />
        <p className="film-page__overview">{film.overview ?? 'No description available.'}</p>
        <WishlistButton
          filmId={film.id}
          filmTitle={film.title}
          category={category}
          isOnList={isOnList}
        />
      </div>

      <FilmInfo film={film} className="film-page__info" />
    </article>
  );
}

/** The wide backdrop when TMDB has one, otherwise the poster. */
function FilmImage({ film }: { film: FilmDetails }) {
  if (!film.backdropPath) {
    return (
      <FilmPoster
        path={film.posterPath}
        title={film.title}
        sizes="(width >= 48rem) 40vw, 100vw"
        priority
      />
    );
  }

  const { src, srcSet } = tmdbImage(film.backdropPath, 'backdrop');
  return (
    <img
      className="film-page__backdrop"
      src={src}
      srcSet={srcSet}
      sizes="(width >= 48rem) 60vw, 100vw"
      alt={`Still from ${film.title}`}
      width={1280}
      height={720}
      fetchPriority="high"
    />
  );
}

function FilmFacts({ film }: { film: FilmDetails }) {
  const facts = [
    film.releaseYear === null ? null : String(film.releaseYear),
    film.runtimeMinutes === null ? null : formatRuntime(film.runtimeMinutes),
    film.rating === null ? null : `★ ${formatRating(film.rating)}`,
  ].filter((fact) => fact !== null);

  if (facts.length === 0) {
    return null;
  }
  return (
    <ul className="film-page__facts" aria-label="Key facts">
      {facts.map((fact) => (
        <li key={fact} className="film-page__fact">
          {fact}
        </li>
      ))}
    </ul>
  );
}
