import { Carousel, type CarouselPosition } from '@/components/Carousel';
import type { FilmSummary } from '@/types/film';

import type { Category } from '../../categories';
import { filmFacts } from '../../film-facts';
import { FilmCard } from '../FilmCard';

import './_film-carousel.scss';

interface FilmCarouselProps {
  films: readonly FilmSummary[];
  category: Category;
  labelledBy: string;
  initialIndex: number;
  getIndexHref: (index: number) => string;
  /** The carousel is above the fold: load its visible posters first. */
  priority: boolean;
  onActiveIndexChange: (index: number) => void;
}

export function FilmCarousel({
  films,
  category,
  labelledBy,
  initialIndex,
  getIndexHref,
  priority,
  onActiveIndexChange,
}: FilmCarouselProps) {
  if (films.length === 0) {
    return <p className="film-carousel__empty">No {category.label.toLowerCase()} films found.</p>;
  }

  return (
    <Carousel
      items={films}
      getKey={(film) => film.id}
      getItemLabel={(film) => film.title}
      itemName="film"
      labelledBy={labelledBy}
      initialIndex={initialIndex}
      getIndexHref={getIndexHref}
      onActiveIndexChange={onActiveIndexChange}
      renderItem={(film, { isVisible }) => (
        <FilmCard
          film={film}
          category={category.slug}
          variant="poster"
          priority={priority && isVisible}
        />
      )}
      renderActiveLabel={(film, position) => <FilmCaption film={film} position={position} />}
    />
  );
}

function FilmCaption({ film, position }: { film: FilmSummary; position: CarouselPosition }) {
  const facts = filmFacts(film);
  const pad = (value: number) => String(value).padStart(2, '0');

  return (
    <>
      <span className="film-carousel__index">{`${pad(position.index + 1)} / ${pad(position.count)}`}</span>
      <span className="film-carousel__title">{film.title}</span>
      {facts.length > 0 && <span className="film-carousel__meta">{facts.join(' · ')}</span>}
    </>
  );
}
