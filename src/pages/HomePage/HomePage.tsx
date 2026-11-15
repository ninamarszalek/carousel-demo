import { Link, useLoaderData } from 'react-router';

import { FilmRow } from '@/features/films/components/FilmRow';

import type { CategoryRow, HomeData } from './home-loader';

import './_home-page.scss';

export function HomePage() {
  const { rows } = useLoaderData<HomeData>();

  return (
    <div className="home-page">
      <header className="home-page__intro">
        <h1 className="home-page__title">Browse films</h1>
        <p className="home-page__lead">
          Pick a category, open a film and add it to your wish list.
        </p>
      </header>
      {rows.map((row, index) => (
        // Only the first row is above the fold; its posters load first.
        <CategorySection key={row.category.slug} row={row} priority={index === 0} />
      ))}
    </div>
  );
}

function CategorySection({ row, priority }: { row: CategoryRow; priority: boolean }) {
  const headingId = `category-${row.category.slug}`;

  return (
    <section className="home-page__category" aria-labelledby={headingId}>
      <h2 className="home-page__category-title" id={headingId}>
        {row.category.label}
      </h2>
      {row.status === 'ok' ? (
        <FilmRow
          films={row.films}
          category={row.category.slug}
          labelledBy={headingId}
          priority={priority}
        />
      ) : (
        <p className="home-page__error" role="alert">
          {`Couldn't load ${row.category.label.toLowerCase()} films. `}
          {/* A navigation to the same URL runs the loaders again; without JS it reloads the page. */}
          <Link to="/" replace preventScrollReset>
            Try again
          </Link>
        </p>
      )}
    </section>
  );
}
