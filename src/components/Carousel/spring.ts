export interface CardMotion {
  /** Current angle in degrees (0 = top of the arc). */
  angle: number;
  /** Degrees per frame. */
  velocity: number;
}

/** How strongly a card is pulled towards its goal (0–1). */
const STIFFNESS = 0.2;
/** How much velocity is kept between frames (0–1); lower settles faster. */
const DAMPING = 0.4;

/** Below this, a card counts as settled (degrees, and degrees per frame). */
const SETTLE_EPSILON = 0.05;

/**
 * Advances every card by one animation frame.
 *
 * The first card in `order` (the leader) springs to its own target. Every other card springs to
 * the angle its predecessor in `order` is at *right now*, plus the gap their targets should have.
 * So the leader pulls the next card, which pulls the next, and a wave runs through the arc.
 *
 * Returns `true` once every card is at rest on its target; the cards are then snapped exactly onto
 * their targets, so the final frame matches the static CSS layout.
 */
export function stepChain(
  cards: CardMotion[],
  targets: readonly number[],
  order: readonly number[],
): boolean {
  let previous: number | undefined;

  for (const index of order) {
    const card = cards[index];
    const target = targets[index];
    if (card === undefined || target === undefined) {
      continue;
    }

    const leader = previous === undefined ? undefined : cards[previous];
    const leaderTarget = previous === undefined ? undefined : targets[previous];
    const goal =
      leader && leaderTarget !== undefined ? leader.angle + (target - leaderTarget) : target;

    card.velocity = (card.velocity + (goal - card.angle) * STIFFNESS) * DAMPING;
    card.angle += card.velocity;
    previous = index;
  }

  const settled = cards.every((card, index) => {
    const target = targets[index] ?? card.angle;
    return (
      Math.abs(target - card.angle) < SETTLE_EPSILON && Math.abs(card.velocity) < SETTLE_EPSILON
    );
  });

  if (settled) {
    cards.forEach((card, index) => {
      card.angle = targets[index] ?? card.angle;
      card.velocity = 0;
    });
  }
  return settled;
}

/**
 * The order in which the chain is updated: the leader is the card at the edge the cards move
 * away from, so the wave starts there and runs across the arc.
 * `direction` > 0 means the carousel moved forwards (cards travel to the left).
 */
export function chainOrder(offsets: readonly number[], direction: number): number[] {
  const indexes = offsets.map((_, index) => index);
  return indexes.sort((a, b) => {
    const delta = (offsets[a] ?? 0) - (offsets[b] ?? 0);
    return direction > 0 ? -delta : delta;
  });
}
