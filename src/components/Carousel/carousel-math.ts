import type { CSSProperties } from 'react';

/** `index` wrapped into `0 … count - 1` (works for negative numbers too). */
export function wrapIndex(index: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  return ((index % count) + count) % count;
}

/**
 * Signed distance of card `index` from the active card, the short way round the circle:
 * `-2` is two cards to the left, `1` is the next card to the right. When both ways are equally
 * long (an even number of cards), the card goes to the right.
 */
export function circularOffset(index: number, activeIndex: number, count: number): number {
  if (count <= 0) {
    return 0;
  }
  const forward = wrapIndex(index - activeIndex, count);
  return forward > count / 2 ? forward - count : forward;
}

export function isVisibleOffset(offset: number, sideCount: number): boolean {
  return Math.abs(offset) <= sideCount;
}

/**
 * Where a card is drawn, in "card steps" from the top of the arc. Cards beyond the visible ones
 * wait (hidden) one step past the edge, so they slide in from there.
 */
export function restingPosition(offset: number, sideCount: number): number {
  const edge = sideCount + 1;
  return Math.max(-edge, Math.min(edge, offset));
}

/**
 * The active index from a URL value such as `?action=4`. Anything that is not a whole number in
 * range falls back to the first card, so a stale or hand-edited link still renders.
 */
export function parseIndexParam(value: string | null | undefined, count: number): number {
  if (!value || !/^\d{1,4}$/.test(value)) {
    return 0;
  }
  const index = Number(value);
  return index < count ? index : 0;
}

export type SlideStyle = CSSProperties & { '--offset': number };

/** Places a slide on the arc; cards nearer the active one stack on top. */
export function slideStyle(offset: number, stackSize: number): SlideStyle {
  return { '--offset': offset, zIndex: stackSize - Math.abs(offset) };
}
