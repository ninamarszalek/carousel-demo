import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type Key,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from 'react';

import { circularOffset, isVisibleOffset, slideStyle, wrapIndex } from './carousel-math';
import { useArcGeometry, useArcMotion, usePrefersReducedMotion } from './use-arc-motion';
import { useCarouselGestures } from './use-carousel-gestures';

import './_carousel.scss';

export interface CarouselItemState {
  isActive: boolean;
  /** Whether the card is on screen (the hidden ones are `inert`). */
  isVisible: boolean;
}

export interface CarouselPosition {
  index: number;
  count: number;
}

export interface CarouselProps<Item> {
  items: readonly Item[];
  getKey: (item: Item) => Key;
  /** A short name for screen readers ("The Matrix"). */
  getItemLabel: (item: Item) => string;
  renderItem: (item: Item, state: CarouselItemState) => ReactNode;
  /** The caption above the arc for the active item. */
  renderActiveLabel?: (item: Item, position: CarouselPosition) => ReactNode;
  labelledBy: string;
  initialIndex?: number;
  /**
   * The URL that shows the carousel at `index`. The arrows link there before hydration (and
   * without JavaScript), so the server can render the requested card in front.
   */
  getIndexHref: (index: number) => string;
  /** What one item is called in control labels: "Previous film", "Film 3 of 20". */
  itemName?: string;
  /** Called on every move, e.g. to change a background together with the carousel. */
  onActiveIndexChange?: (index: number) => void;
}

const noopSubscribe = () => () => undefined;

/** `false` on the server and during hydration, `true` afterwards. */
function useIsHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The resting layout is CSS only (`--offset` per slide), so the server renders the finished arc
 * and hydration moves nothing; the chained-spring motion is added on top in the browser.
 * Accessibility follows the WAI-ARIA APG carousel pattern.
 */
export function Carousel<Item>({
  items,
  getKey,
  getItemLabel,
  renderItem,
  renderActiveLabel,
  labelledBy,
  initialIndex = 0,
  getIndexHref,
  itemName = 'item',
  onActiveIndexChange,
}: CarouselProps<Item>) {
  const count = items.length;
  const [activeIndex, setActiveIndex] = useState(() => wrapIndex(initialIndex, count));
  const [announcement, setAnnouncement] = useState('');
  const rootRef = useRef<HTMLElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const focusAfterMove = useRef(false);

  const isHydrated = useIsHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const { sideCount, gapAngle } = useArcGeometry(rootRef);
  useArcMotion({ trackRef, activeIndex, count, sideCount, gapAngle, reducedMotion });

  const move = (steps: number, { announce = false, focus = false } = {}) => {
    if (count === 0 || steps === 0) {
      return;
    }
    const next = wrapIndex(activeIndex + steps, count);
    setActiveIndex(next);
    onActiveIndexChange?.(next);
    focusAfterMove.current = focus;
    if (announce) {
      const item = items[next];
      setAnnouncement(
        item === undefined
          ? ''
          : `${capitalize(itemName)} ${String(next + 1)} of ${String(count)}: ${getItemLabel(item)}`,
      );
    }
  };

  const gestures = useCarouselGestures((steps) => {
    move(steps);
  });

  // Keyboard users keep their place: after ← → the focus follows the active card.
  useEffect(() => {
    if (!focusAfterMove.current) {
      return;
    }
    focusAfterMove.current = false;
    trackRef.current?.children[activeIndex]
      ?.querySelector<HTMLElement>('a, button, [tabindex]')
      ?.focus({ preventScroll: true });
  }, [activeIndex]);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
      return;
    }
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      Home: -activeIndex,
      End: count - 1 - activeIndex,
    };
    const step = steps[event.key];
    if (step !== undefined) {
      event.preventDefault();
      move(step, { announce: true, focus: true });
    }
  };

  const onArrowClick = (steps: number) => (event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    move(steps, { announce: true });
  };

  const activeItem = items[activeIndex];
  const previousIndex = wrapIndex(activeIndex - 1, count);
  const nextIndex = wrapIndex(activeIndex + 1, count);

  return (
    // Key presses bubble up from the focused card or button; the region itself is not a control.
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <section
      ref={rootRef}
      className="carousel"
      aria-roledescription="carousel"
      aria-labelledby={labelledBy}
      onKeyDown={onKeyDown}
    >
      {renderActiveLabel && activeItem !== undefined && (
        // The live region below announces changes; this is the visual caption.
        <div className="carousel__label" aria-hidden="true">
          {renderActiveLabel(activeItem, { index: activeIndex, count })}
        </div>
      )}

      <div className="carousel__stage" {...gestures}>
        <div className="carousel__track" ref={trackRef}>
          {items.map((item, index) => {
            const offset = circularOffset(index, activeIndex, count);
            const isVisible = isVisibleOffset(offset, sideCount);
            return (
              <div
                key={getKey(item)}
                className={
                  offset === 0 ? 'carousel__slide carousel__slide--active' : 'carousel__slide'
                }
                role="group"
                aria-roledescription="slide"
                aria-label={`${String(index + 1)} of ${String(count)}`}
                inert={!isVisible}
                style={slideStyle(offset, count)}
                data-carousel-slide
              >
                <div className="carousel__card">
                  {renderItem(item, { isActive: offset === 0, isVisible })}
                </div>
              </div>
            );
          })}
        </div>

        {count > 1 && (
          <>
            <ArrowControl
              direction="previous"
              label={`Previous ${itemName}`}
              href={getIndexHref(previousIndex)}
              isHydrated={isHydrated}
              onClick={onArrowClick(-1)}
            />
            <ArrowControl
              direction="next"
              label={`Next ${itemName}`}
              href={getIndexHref(nextIndex)}
              isHydrated={isHydrated}
              onClick={onArrowClick(1)}
            />
          </>
        )}
      </div>

      <p className="carousel__status visually-hidden" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

interface ArrowControlProps {
  direction: 'previous' | 'next';
  label: string;
  href: string;
  isHydrated: boolean;
  onClick: (event: MouseEvent<HTMLElement>) => void;
}

/**
 * Before hydration (and without JavaScript) the arrow is a link to the URL with the neighbouring
 * card in front, rendered by the server. Once the app is interactive it becomes a real button that
 * moves the carousel in place.
 */
function ArrowControl({ direction, label, href, isHydrated, onClick }: ArrowControlProps) {
  const className = `carousel__button carousel__button--${direction}`;
  const icon = (
    <svg className="carousel__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d={direction === 'previous' ? 'M15 5l-7 7 7 7' : 'M9 5l7 7-7 7'} />
    </svg>
  );

  if (!isHydrated) {
    return (
      <a className={className} href={href} aria-label={label}>
        {icon}
      </a>
    );
  }
  return (
    <button type="button" className={className} aria-label={label} onClick={onClick}>
      {icon}
    </button>
  );
}
