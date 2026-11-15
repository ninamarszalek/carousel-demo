import { slideStyle } from './carousel-math';

import './_carousel.scss';

interface CarouselSkeletonProps {
  /** Announced to screen readers while loading, e.g. "Loading action films". */
  label: string;
}

/** As many placeholders as the widest layout shows; CSS hides the extra ones on small screens. */
const PLACEHOLDER_OFFSETS = [-3, -2, -1, 0, 1, 2, 3];

/**
 * A placeholder with the same geometry as `Carousel` (same card positions), shown
 * while the items load. Swapping it for the real carousel moves nothing on the page.
 */
export function CarouselSkeleton({ label }: CarouselSkeletonProps) {
  return (
    <div className="carousel carousel--skeleton" role="status" aria-label={label}>
      <div className="carousel__label" aria-hidden="true">
        <span className="carousel__placeholder carousel__placeholder--text" />
        <span className="carousel__placeholder carousel__placeholder--text-short" />
      </div>
      <div className="carousel__stage" aria-hidden="true">
        <div className="carousel__track">
          {PLACEHOLDER_OFFSETS.map((offset) => (
            <div
              key={offset}
              className="carousel__slide"
              style={slideStyle(offset, PLACEHOLDER_OFFSETS.length)}
            >
              <div className="carousel__card">
                <span className="carousel__placeholder carousel__placeholder--card" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
