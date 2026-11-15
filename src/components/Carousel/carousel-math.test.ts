import { describe, expect, it } from 'vitest';

import {
  circularOffset,
  isVisibleOffset,
  parseIndexParam,
  restingPosition,
  slideStyle,
  wrapIndex,
} from './carousel-math';

describe('wrapIndex', () => {
  it.each([
    [0, 5, 0],
    [5, 5, 0],
    [-1, 5, 4],
    [-6, 5, 4],
    [12, 5, 2],
    [3, 0, 0],
  ])('wraps %i into %i cards → %i', (index, count, expected) => {
    expect(wrapIndex(index, count)).toBe(expected);
  });
});

describe('circularOffset', () => {
  it('measures the short way round the circle', () => {
    // 7 cards, card 2 active.
    expect([0, 1, 2, 3, 4, 5, 6].map((index) => circularOffset(index, 2, 7))).toStrictEqual([
      -2, -1, 0, 1, 2, 3, -3,
    ]);
  });

  it('puts the opposite card on the right when the count is even', () => {
    expect([0, 1, 2, 3].map((index) => circularOffset(index, 0, 4))).toStrictEqual([0, 1, 2, -1]);
  });

  it('handles tiny carousels', () => {
    expect(circularOffset(0, 0, 1)).toBe(0);
    expect(circularOffset(0, 0, 0)).toBe(0);
  });
});

describe('visibility and resting positions', () => {
  it('shows the cards within the side count', () => {
    expect(isVisibleOffset(-3, 3)).toBe(true);
    expect(isVisibleOffset(4, 3)).toBe(false);
  });

  it('parks hidden cards one step past the edge', () => {
    expect([-9, -4, -3, 0, 2, 4, 9].map((offset) => restingPosition(offset, 3))).toStrictEqual([
      -4, -4, -3, 0, 2, 4, 4,
    ]);
  });
});

describe('parseIndexParam', () => {
  it.each([
    ['4', 10, 4],
    ['0', 10, 0],
    ['9', 10, 9],
    ['10', 10, 0],
    ['-1', 10, 0],
    ['1.5', 10, 0],
    ['abc', 10, 0],
    ['', 10, 0],
    [null, 10, 0],
    ['99999', 10, 0],
  ])('parses %j for %i cards as %i', (value, count, expected) => {
    expect(parseIndexParam(value, count)).toBe(expected);
  });
});

describe('slideStyle', () => {
  it('sets the offset and stacks nearer cards on top', () => {
    expect(slideStyle(0, 10)).toEqual({ '--offset': 0, zIndex: 10 });
    expect(slideStyle(-2, 10)).toEqual({ '--offset': -2, zIndex: 8 });
  });
});
