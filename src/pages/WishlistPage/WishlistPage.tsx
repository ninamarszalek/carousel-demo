import { Link, useLoaderData } from 'react-router';

import { FilmCard } from '@/features/films/components/FilmCard';
import { WishlistButton } from '@/features/wishlist/components/WishlistButton';
import { pluralize } from '@/lib/format';

import type { WishlistPageData } from './wishlist-loader';

import './_wishlist-page.scss';

export function WishlistPage() {
  const { entries } = useLoaderData<WishlistPageData>();

  return (
    <section className="wishlist-page" aria-labelledby="wishlist-title">
      <header className="wishlist-page__header">
        <h1 className="wishlist-page__title" id="wishlist-title">
          Your wish list
        </h1>
        <p className="wishlist-page__count">
          {entries.length === 0 ? 'No films yet.' : pluralize(entries.length, 'film')}
        </p>
      </header>

      {entries.length === 0 ? (
        <p className="wishlist-page__empty">
          Open a film and press &ldquo;Add to wish list&rdquo; to save it here.{' '}
          <Link to="/">Browse films</Link>
        </p>
      ) : (
        <ul className="wishlist-page__grid">
          {entries.map(({ film, category }) => (
            <li key={film.id} className="wishlist-page__item">
              <FilmCard film={film} category={category} />
              <WishlistButton
                filmId={film.id}
                filmTitle={film.title}
                category={category}
                isOnList
                variant="remove"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
