import { useLoaderData } from 'react-router';

import { FilmPoster } from '@/features/films/components/FilmPoster';
import { filmFacts } from '@/features/films/film-facts';
import { WishlistButton } from '@/features/wishlist/components/WishlistButton';
import { useWishlist } from '@/features/wishlist/use-wishlist';
import { hasItem } from '@/features/wishlist/wishlist-cookie';
import { tmdbImage } from '@/lib/tmdb-image';
import type { FilmDetails } from '@/types/film';

import type { FilmPageData } from './film-loader';
import { FilmInfo } from './FilmInfo';

import './_film-details-page.scss';

export function FilmDetailsPage() {
  const { film, category } = useLoaderData<FilmPageData>();
  const isOnList = hasItem(useWishlist(), film.id);

  return (
    <article className="film-page" data-category={category ?? undefined}>
      <div className="film-page__hero">
        <div className="film-page__hero-inner container">
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
        </div>
      </div>

      <div className="container">
        <FilmInfo film={film} className="film-page__info" />
      </div>
    </article>
  );
}

/** The wide backdrop when TMDB has one, otherwise the poster. */
function FilmImage({ film }: { film: FilmDetails }) {
  if (!film.backdropPath) {
    return (
      <div className="film-page__poster">
        <FilmPoster path={film.posterPath} title={film.title} sizes="20rem" priority />
      </div>
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
  const facts = filmFacts(film);

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
