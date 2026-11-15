import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type RefObject,
} from 'react';

import { circularOffset, restingPosition } from './carousel-math';
import { chainOrder, stepChain, type CardMotion } from './spring';

/** Before CSS has been read: the widest layout, as rendered on the server (and by the skeleton). */
export const DEFAULT_SIDE_COUNT = 3;
const DEFAULT_GAP_ANGLE = 12;

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** `null` where the browser (or a test environment) has no `matchMedia`. */
function reducedMotionQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(REDUCED_MOTION_QUERY) : null;
}

function subscribeToReducedMotion(onChange: () => void): () => void {
  const query = reducedMotionQuery();
  query?.addEventListener('change', onChange);
  return () => {
    query?.removeEventListener('change', onChange);
  };
}

/** The user's reduced-motion preference. The server assumes "no preference". */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => reducedMotionQuery()?.matches ?? false,
    () => false,
  );
}

function readNumberToken(element: Element | null, name: string, fallback: number): number {
  if (!element) {
    return fallback;
  }
  const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(name));
  return Number.isFinite(value) ? value : fallback;
}

export interface ArcGeometry {
  /** Cards visible on each side of the active one. */
  sideCount: number;
  /** Degrees between neighbouring cards. */
  gapAngle: number;
}

/**
 * The arc geometry, read from the `--carousel-side-count` and `--carousel-gap-angle` CSS tokens,
 * so the breakpoints live in the stylesheet only.
 */
export function useArcGeometry(rootRef: RefObject<HTMLElement | null>): ArcGeometry {
  const [sideCount, setSideCount] = useState(DEFAULT_SIDE_COUNT);
  const [gapAngle, setGapAngle] = useState(DEFAULT_GAP_ANGLE);

  useEffect(() => {
    const update = () => {
      const root = rootRef.current;
      setSideCount(Math.round(readNumberToken(root, '--carousel-side-count', DEFAULT_SIDE_COUNT)));
      setGapAngle(readNumberToken(root, '--carousel-gap-angle', DEFAULT_GAP_ANGLE));
    };
    update();
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
    };
  }, [rootRef]);

  return { sideCount, gapAngle };
}

interface ArcMotionOptions extends ArcGeometry {
  trackRef: RefObject<HTMLElement | null>;
  activeIndex: number;
  count: number;
  reducedMotion: boolean;
}

interface MotionState {
  activeIndex: number;
  count: number;
  offsets: number[];
  cards: CardMotion[];
  targets: number[];
  order: number[];
  frame: number | null;
}

function slidesOf(track: HTMLElement | null): HTMLElement[] {
  return track ? (Array.from(track.children) as HTMLElement[]) : [];
}

function writeAngles(track: HTMLElement | null, cards: readonly CardMotion[]): void {
  slidesOf(track).forEach((slide, index) => {
    const card = cards[index];
    if (card) {
      slide.style.setProperty('--angle', `${card.angle.toFixed(3)}deg`);
    }
  });
}

/** Hands the slides back to the CSS layout (`--offset`), which is where the springs ended. */
function clearAngles(track: HTMLElement | null): void {
  slidesOf(track).forEach((slide) => {
    slide.style.removeProperty('--angle');
  });
}

/**
 * Animates the slides with the chained spring when `activeIndex` changes.
 *
 * The resting layout is pure CSS (`--offset` per slide, rendered by React, also on the server).
 * While moving, this hook writes an inline `--angle` per slide on every frame, straight to the DOM
 * (no React re-render per frame), and removes it once the springs settle on the CSS positions.
 */
export function useArcMotion({
  trackRef,
  activeIndex,
  count,
  sideCount,
  gapAngle,
  reducedMotion,
}: ArcMotionOptions): void {
  const state = useRef<MotionState | null>(null);

  // A layout effect, so the first animated frame is written before the browser paints the new
  // `--offset` positions (otherwise the cards would flash to their targets for one frame).
  useLayoutEffect(() => {
    const track = trackRef.current;
    const offsets = Array.from({ length: count }, (_, index) =>
      circularOffset(index, activeIndex, count),
    );
    const targets = offsets.map((offset) => restingPosition(offset, sideCount) * gapAngle);
    const previous = state.current;

    const canAnimate =
      !reducedMotion &&
      typeof requestAnimationFrame === 'function' &&
      previous !== null &&
      previous.count === count &&
      previous.activeIndex !== activeIndex;

    if (!canAnimate) {
      if (previous && previous.frame !== null) {
        cancelAnimationFrame(previous.frame);
      }
      clearAngles(track);
      state.current = {
        activeIndex,
        count,
        offsets,
        targets,
        order: [],
        cards: targets.map((angle) => ({ angle, velocity: 0 })),
        frame: null,
      };
      return;
    }

    // A card whose offset wraps from one end to the other would sweep across the whole arc.
    // Instead it jumps (while hidden) to just past the edge it enters from.
    const edgeAngle = (sideCount + 1) * gapAngle;
    offsets.forEach((offset, index) => {
      const card = previous.cards[index];
      const oldOffset = previous.offsets[index] ?? offset;
      if (card && Math.abs(offset - oldOffset) > count / 2) {
        card.angle = Math.sign(offset || 1) * edgeAngle;
        card.velocity = 0;
      }
    });

    const direction = circularOffset(activeIndex, previous.activeIndex, count);
    previous.activeIndex = activeIndex;
    previous.offsets = offsets;
    previous.targets = targets;
    previous.order = chainOrder(offsets, direction);
    writeAngles(track, previous.cards);

    if (previous.frame === null) {
      const tick = () => {
        const motion = state.current;
        if (!motion) {
          return;
        }
        const settled = stepChain(motion.cards, motion.targets, motion.order);
        if (settled) {
          motion.frame = null;
          clearAngles(trackRef.current);
          return;
        }
        writeAngles(trackRef.current, motion.cards);
        motion.frame = requestAnimationFrame(tick);
      };
      previous.frame = requestAnimationFrame(tick);
    }
  }, [trackRef, activeIndex, count, sideCount, gapAngle, reducedMotion]);

  useEffect(
    () => () => {
      const frame = state.current?.frame ?? null;
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
    },
    [],
  );
}
