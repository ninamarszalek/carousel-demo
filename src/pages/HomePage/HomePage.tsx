import { memo, Suspense, useCallback, useRef, useState, type ReactNode } from 'react';
import { Await, Link, useLoaderData, useSearchParams } from 'react-router';

import { CarouselSkeleton, parseIndexParam } from '@/components/Carousel';
import {
  gradientStep,
  isCategorySlug,
  type Category,
  type CategorySlug,
} from '@/features/films/categories';
import { FilmCarousel } from '@/features/films/components/FilmCarousel';
import type { FilmSummary } from '@/types/film';

import type { CategoryRow, HomeData } from './home-loader';
import { useMostVisible } from './use-most-visible';

import './_home-page.scss';

/**
 * Until a row's films arrive, any index from the URL is accepted: the carousel wraps it into
 * range when it mounts.
 */
const UNKNOWN_COUNT = Number.POSITIVE_INFINITY;

/**
 * One screen-high panel per category, with its carousel docked to the bottom. Scrolling snaps
 * from panel to panel. Behind them, one fixed glow takes the colours of the category on screen
 * (and of its active film), so scrolling and sliding both make the light flow.
 */
export function HomePage() {
  const { rows } = useLoaderData<HomeData>();
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);

  // The carousels start at the film named in the URL (`/?action=4`); the server renders the same
  // indexes, so the glow matches after hydration.
  const [activeIndexes, setActiveIndexes] = useState<Partial<Record<CategorySlug, number>>>(() =>
    Object.fromEntries(
      rows.map((row) => [
        row.category.slug,
        parseIndexParam(
          searchParams.get(row.category.slug),
          row.status === 'loaded' ? row.films.length : UNKNOWN_COUNT,
        ),
      ]),
    ),
  );

  // `null` until measured (server, hydration): then every panel renders in its resting state.
  const mostVisible = useMostVisible(containerRef, '[data-key]');
  const onScreen = isCategorySlug(mostVisible) ? mostVisible : null;
  const glowCategory = onScreen ?? rows[0]?.category.slug;
  const glowIndex = glowCategory === undefined ? 0 : (activeIndexes[glowCategory] ?? 0);

  const onActiveIndexChange = useCallback((slug: CategorySlug, activeIndex: number) => {
    setActiveIndexes((indexes) => ({ ...indexes, [slug]: activeIndex }));
  }, []);

  return (
    <div className="home-page" ref={containerRef}>
      <h1 className="visually-hidden">Browse films</h1>
      <div
        className="home-page__glow"
        aria-hidden="true"
        data-category={glowCategory}
        data-gradient-step={gradientStep(glowIndex)}
        data-testid="category-glow"
      />
      {rows.map((row, index) => (
        <CategoryPanel
          key={row.category.slug}
          row={row}
          activeIndex={activeIndexes[row.category.slug] ?? 0}
          onScreen={onScreen}
          // Only the first carousel is above the fold; its posters load first.
          priority={index === 0}
          onActiveIndexChange={onActiveIndexChange}
        />
      ))}
    </div>
  );
}

interface CategoryPanelProps {
  row: CategoryRow;
  /** Starts at the film from the URL, then follows the carousel. */
  activeIndex: number;
  /** The category most on screen; `null` until measured, when every panel rests as it is. */
  onScreen: CategorySlug | null;
  priority: boolean;
  onActiveIndexChange: (slug: CategorySlug, index: number) => void;
}

type PanelState = 'active' | 'inactive';

/** No state before the page knows what is on screen: then every panel is shown as it is. */
function panelState(onScreen: CategorySlug | null, slug: CategorySlug): PanelState | undefined {
  if (onScreen === null) {
    return undefined;
  }
  return onScreen === slug ? 'active' : 'inactive';
}

const CategoryPanel = memo(function CategoryPanel({
  row,
  activeIndex,
  onScreen,
  priority,
  onActiveIndexChange,
}: CategoryPanelProps) {
  const { category } = row;
  const headingId = `category-${category.slug}`;
  const [searchParams] = useSearchParams();

  const getIndexHref = (index: number) => {
    const params = new URLSearchParams(searchParams);
    params.set(category.slug, String(index));
    return `?${params.toString()}`;
  };

  const renderCarousel = (films: FilmSummary[]) => (
    <FilmCarousel
      films={films}
      category={category}
      labelledBy={headingId}
      // Read once, when the carousel mounts.
      initialIndex={activeIndex}
      getIndexHref={getIndexHref}
      priority={priority}
      onActiveIndexChange={(index) => {
        onActiveIndexChange(category.slug, index);
      }}
    />
  );

  return (
    <div
      className="home-page__panel"
      data-key={category.slug}
      data-category={category.slug}
      data-gradient-step={gradientStep(activeIndex)}
      data-state={panelState(onScreen, category.slug)}
      data-testid={`category-panel-${category.slug}`}
    >
      {/* This panel's own light, used on portrait screens (see _home-page.scss). */}
      <div className="home-page__panel-glow" aria-hidden="true" />
      <div className="home-page__panel-inner">
        <h2 className="home-page__panel-title" id={headingId}>
          {category.label}
        </h2>
        <CategoryFilms row={row} renderCarousel={renderCarousel} />
      </div>
    </div>
  );
});

interface CategoryFilmsProps {
  row: CategoryRow;
  renderCarousel: (films: FilmSummary[]) => ReactNode;
}

/** The row's carousel, skeleton or error, by how far its loading got. */
function CategoryFilms({ row, renderCarousel }: CategoryFilmsProps) {
  const { category } = row;

  switch (row.status) {
    case 'failed':
      return <CategoryError category={category} />;
    case 'loaded':
      // Always the case on the server: render straight away. Going through <Await> here would
      // suspend for a moment even with ready data, and the server would stream a skeleton first.
      return renderCarousel(row.films);
    case 'pending':
      return (
        <Suspense
          fallback={<CarouselSkeleton label={`Loading ${category.label.toLowerCase()} films`} />}
        >
          <Await resolve={row.films} errorElement={<CategoryError category={category} />}>
            {renderCarousel}
          </Await>
        </Suspense>
      );
  }
}

function CategoryError({ category }: { category: Category }) {
  return (
    <div className="container">
      <p className="home-page__error" role="alert">
        {`Couldn't load ${category.label.toLowerCase()} films. `}
        {/* A navigation to the same URL runs the loaders again; without JS it reloads the page. */}
        <Link to="/" replace preventScrollReset>
          Try again
        </Link>
      </p>
    </div>
  );
}
