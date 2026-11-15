import { describe, expect, it } from 'vitest';

import { chainOrder, stepChain, type CardMotion } from './spring';

function cardsAt(angles: number[]): CardMotion[] {
  return angles.map((angle) => ({ angle, velocity: 0 }));
}

/** Runs frames until the chain settles; fails if it never does. */
function runUntilSettled(cards: CardMotion[], targets: number[], order: number[], maxFrames = 500) {
  for (let frame = 1; frame <= maxFrames; frame += 1) {
    if (stepChain(cards, targets, order)) {
      return frame;
    }
  }
  throw new Error('The springs did not settle.');
}

describe('stepChain', () => {
  it('moves every card onto its target and reports when it has settled', () => {
    const cards = cardsAt([0, 10, 20]);
    const targets = [-10, 0, 10];

    const frames = runUntilSettled(cards, targets, [2, 1, 0]);

    expect(cards.map((card) => card.angle)).toStrictEqual(targets);
    expect(cards.every((card) => card.velocity === 0)).toBe(true);
    expect(frames).toBeLessThan(200);
  });

  it('pulls the cards one after another: the leader moves first, the last card lags', () => {
    const cards = cardsAt([0, 10, 20]);
    const targets = [-10, 0, 10];

    const start = [0, 10, 20];
    stepChain(cards, targets, [2, 1, 0]);

    const [first = 0, second = 0, leader = 0] = cards.map((card, index) =>
      Math.abs(card.angle - (start[index] ?? 0)),
    );
    expect(leader).toBeGreaterThan(second);
    expect(second).toBeGreaterThan(first);
  });

  it('is already settled when every card is on its target', () => {
    const cards = cardsAt([0, 12]);

    expect(stepChain(cards, [0, 12], [0, 1])).toBe(true);
  });
});

describe('chainOrder', () => {
  it('starts the wave at the right edge when moving forwards, and at the left when going back', () => {
    const offsets = [0, 1, -1, 2];

    expect(chainOrder(offsets, 1)).toStrictEqual([3, 1, 0, 2]);
    expect(chainOrder(offsets, -1)).toStrictEqual([2, 0, 1, 3]);
  });
});
