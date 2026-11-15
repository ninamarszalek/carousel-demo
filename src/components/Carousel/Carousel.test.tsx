import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Carousel } from './Carousel';
import { CarouselSkeleton } from './CarouselSkeleton';

const PLANETS = [
  'Mercury',
  'Venus',
  'Earth',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];

function renderCarousel({
  items = PLANETS,
  initialIndex = 0,
  onItemClick = () => undefined,
  onActiveIndexChange,
}: {
  items?: string[];
  initialIndex?: number;
  onItemClick?: () => void;
  onActiveIndexChange?: (index: number) => void;
} = {}) {
  render(
    <>
      <h2 id="planets">Planets</h2>
      <Carousel
        items={items}
        getKey={(item) => item}
        getItemLabel={(item) => item}
        itemName="planet"
        labelledBy="planets"
        initialIndex={initialIndex}
        getIndexHref={(index) => `?planets=${String(index)}`}
        {...(onActiveIndexChange && { onActiveIndexChange })}
        renderItem={(item) => (
          <a href={`/planets/${item}`} onClick={onItemClick}>
            {item}
          </a>
        )}
        renderActiveLabel={(item, { index, count }) =>
          `${String(index + 1)}/${String(count)} ${item}`
        }
      />
    </>,
  );
  const carousel = screen.getByRole('region', { name: 'Planets' });
  return { carousel, user: userEvent.setup() };
}

/** The visual caption above the arc shows exactly this (screen readers get the live region). */
function expectCaption(carousel: HTMLElement, text: string): void {
  expect(within(carousel).getByText(text)).toBeInTheDocument();
}

/** The slide of a planet, found by its accessible label ("3 of 9"); hidden slides included. */
function slideOf(name: string, items: readonly string[] = PLANETS): HTMLElement {
  const label = `${String(items.indexOf(name) + 1)} of ${String(items.length)}`;
  return screen.getByRole('group', { name: label, hidden: true });
}

/** Dispatches a pointer event the way React listens for it (jsdom has no PointerEvent). */
function pointer(target: Element, type: string, clientX: number, pointerType = 'touch') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX });
  Object.assign(event, { pointerId: 1, pointerType, isPrimary: true });
  fireEvent(target, event);
}

describe('Carousel', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a labelled carousel region with one labelled slide per item', () => {
    const { carousel } = renderCarousel();

    expect(carousel).toHaveAttribute('aria-roledescription', 'carousel');
    const slides = within(carousel).getAllByRole('group', { hidden: true });
    expect(slides).toHaveLength(PLANETS.length);
    expect(slides[0]).toHaveAttribute('aria-roledescription', 'slide');
    expect(slides[0]).toHaveAttribute('aria-label', '1 of 9');
    expectCaption(carousel, '1/9 Mercury');
  });

  it('places the slides around the active one, the short way round', () => {
    renderCarousel({ initialIndex: 0 });

    expect(slideOf('Mercury').style.getPropertyValue('--offset')).toBe('0');
    expect(slideOf('Venus').style.getPropertyValue('--offset')).toBe('1');
    expect(slideOf('Pluto').style.getPropertyValue('--offset')).toBe('-1');
    expect(slideOf('Saturn').style.getPropertyValue('--offset')).toBe('-4');
  });

  it('makes the cards off screen inert, so keyboard and screen readers skip them', () => {
    renderCarousel();

    expect(slideOf('Uranus')).not.toHaveAttribute('inert');
    expect(slideOf('Jupiter')).toHaveAttribute('inert');
    expect(slideOf('Saturn')).toHaveAttribute('inert');
  });

  it('moves with the arrow buttons, wraps around both ends, and announces the new item', async () => {
    const { carousel, user } = renderCarousel();

    await user.click(within(carousel).getByRole('button', { name: 'Previous planet' }));

    expectCaption(carousel, '9/9 Pluto');
    expect(within(carousel).getByText('Planet 9 of 9: Pluto')).toBeInTheDocument();

    await user.click(within(carousel).getByRole('button', { name: 'Next planet' }));
    await user.click(within(carousel).getByRole('button', { name: 'Next planet' }));

    expectCaption(carousel, '2/9 Venus');
  });

  it('moves with the keyboard, and the focus follows the active card', async () => {
    const { carousel, user } = renderCarousel();
    within(carousel).getByRole('link', { name: 'Mercury' }).focus();

    await user.keyboard('{ArrowRight}');
    expectCaption(carousel, '2/9 Venus');
    expect(within(carousel).getByRole('link', { name: 'Venus' })).toHaveFocus();

    await user.keyboard('{End}');
    expectCaption(carousel, '9/9 Pluto');
    expect(within(carousel).getByRole('link', { name: 'Pluto' })).toHaveFocus();

    await user.keyboard('{ArrowRight}');
    expectCaption(carousel, '1/9 Mercury');

    await user.keyboard('{ArrowLeft}{Home}');
    expectCaption(carousel, '1/9 Mercury');
  });

  it('ignores arrow keys with modifiers (browser shortcuts)', async () => {
    const { carousel, user } = renderCarousel();
    within(carousel).getByRole('link', { name: 'Mercury' }).focus();

    await user.keyboard('{Alt>}{ArrowRight}{/Alt}');

    expectCaption(carousel, '1/9 Mercury');
  });

  it('reports every move, so the page can change with it', async () => {
    const onActiveIndexChange = vi.fn();
    const { carousel, user } = renderCarousel({ onActiveIndexChange });

    await user.click(within(carousel).getByRole('button', { name: 'Next planet' }));
    await user.click(within(carousel).getByRole('button', { name: 'Previous planet' }));
    await user.click(within(carousel).getByRole('button', { name: 'Previous planet' }));

    expect(onActiveIndexChange.mock.calls).toStrictEqual([[1], [0], [8]]);
  });

  it('starts at the initial index', () => {
    const { carousel } = renderCarousel({ initialIndex: 4 });

    expectCaption(carousel, '5/9 Jupiter');
  });

  it('moves one card per third of a card dragged, and a drag does not open the card', () => {
    const onItemClick = vi.fn();
    const { carousel } = renderCarousel({ onItemClick });
    // Gestures are handled on the stage; events bubble up to it from the slides.
    const stage = slideOf('Mercury');
    // jsdom has no layout, so the card width falls back to 150 px: one step per 50 px.

    pointer(stage, 'pointerdown', 300);
    pointer(stage, 'pointermove', 240);
    expectCaption(carousel, '2/9 Venus');
    pointer(stage, 'pointermove', 130);
    expectCaption(carousel, '4/9 Mars');
    pointer(stage, 'pointerup', 130);
    fireEvent.click(within(carousel).getByRole('link', { name: 'Mars' }));

    expect(onItemClick).not.toHaveBeenCalled();
  });

  it('lets a tap through as a click', () => {
    const onItemClick = vi.fn();
    const { carousel } = renderCarousel({ onItemClick });
    const link = within(carousel).getByRole('link', { name: 'Mercury' });

    pointer(link, 'pointerdown', 300);
    pointer(link, 'pointerup', 302);
    fireEvent.click(link);

    expect(onItemClick).toHaveBeenCalledOnce();
  });

  it('does not react to mouse drags (the mouse uses the buttons)', () => {
    const { carousel } = renderCarousel();
    const stage = slideOf('Mercury');

    pointer(stage, 'pointerdown', 300, 'mouse');
    pointer(stage, 'pointermove', 100, 'mouse');

    expectCaption(carousel, '1/9 Mercury');
  });

  it('moves with horizontal wheel or trackpad gestures, but never captures vertical scrolling', () => {
    vi.spyOn(performance, 'now').mockReturnValue(1000);
    const { carousel } = renderCarousel();
    const stage = slideOf('Mercury');

    fireEvent.wheel(stage, { deltaX: 0, deltaY: 120 });
    expectCaption(carousel, '1/9 Mercury');

    fireEvent.wheel(stage, { deltaX: 25, deltaY: 2 });
    fireEvent.wheel(stage, { deltaX: 25, deltaY: 2 });
    expectCaption(carousel, '2/9 Venus');

    // The rest of the same gesture is ignored for a moment.
    fireEvent.wheel(stage, { deltaX: 80, deltaY: 0 });
    expectCaption(carousel, '2/9 Venus');

    vi.spyOn(performance, 'now').mockReturnValue(2000);
    fireEvent.wheel(stage, { deltaX: -60, deltaY: 0 });
    expectCaption(carousel, '1/9 Mercury');
  });

  it('animates with inline angles that are removed once the springs settle', async () => {
    vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] });
    const { carousel } = renderCarousel();

    fireEvent.click(within(carousel).getByRole('button', { name: 'Next planet' }));
    expect(slideOf('Venus').style.getPropertyValue('--angle')).not.toBe('');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(slideOf('Venus').style.getPropertyValue('--angle')).toBe('');
    expect(slideOf('Venus').style.getPropertyValue('--offset')).toBe('0');
    vi.useRealTimers();
  });

  it('jumps without animation when the user prefers reduced motion', () => {
    vi.stubGlobal(
      'matchMedia',
      (query: string) =>
        ({
          matches: query.includes('reduce'),
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList,
    );
    const { carousel } = renderCarousel();

    fireEvent.click(within(carousel).getByRole('button', { name: 'Next planet' }));

    expectCaption(carousel, '2/9 Venus');
    expect(slideOf('Venus').style.getPropertyValue('--angle')).toBe('');
  });

  it('has no arrows when there is only one item', () => {
    const { carousel } = renderCarousel({ items: ['Earth'] });

    expect(within(carousel).queryByRole('button')).not.toBeInTheDocument();
    expectCaption(carousel, '1/1 Earth');
  });
});

describe('CarouselSkeleton', () => {
  it('announces the loading state', () => {
    render(<CarouselSkeleton label="Loading planets" />);

    expect(screen.getByRole('status', { name: 'Loading planets' })).toBeInTheDocument();
  });
});
