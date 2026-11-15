import { useRef, type MouseEvent, type PointerEvent, type WheelEvent } from 'react';

/** A drag longer than this is a swipe, not a click: the link under the finger must not open. */
const CLICK_SLOP_PX = 10;
/** Horizontal wheel/trackpad distance that counts as one step. */
const WHEEL_STEP_PX = 40;
/** After a wheel step, ignore the rest of the same gesture (trackpads send many events). */
const WHEEL_LOCK_MS = 350;
/** Dragging this share of a card's width moves the carousel by one card. */
const DRAG_STEP_SHARE = 1 / 3;
const FALLBACK_CARD_WIDTH_PX = 150;

interface DragState {
  pointerId: number;
  /** Where the drag started (for telling a swipe from a tap). */
  startX: number;
  /** Where the last step happened; the next step needs another `stepWidth` from here. */
  anchorX: number;
  stepWidth: number;
}

interface GestureHandlers {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
  onClickCapture: (event: MouseEvent<HTMLElement>) => void;
  onWheel: (event: WheelEvent<HTMLElement>) => void;
}

/**
 * Touch/pen drag and horizontal wheel/trackpad gestures for the carousel stage. `onStep(+1)` moves
 * to the next card, `onStep(-1)` to the previous one.
 *
 * Vertical gestures are never captured, so the page keeps scrolling normally (`touch-action:
 * pan-y` on the stage lets the browser handle vertical touch scrolling).
 */
export function useCarouselGestures(onStep: (steps: number) => void): GestureHandlers {
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const wheel = useRef({ distance: 0, lockedUntil: 0 });

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    if (drag.current?.pointerId === event.pointerId) {
      drag.current = null;
    }
  };

  return {
    onPointerDown(event) {
      // The mouse uses the buttons and the wheel; dragging with it would fight text selection
      // and native image dragging.
      if (event.pointerType === 'mouse' || !event.isPrimary) {
        return;
      }
      const slide = event.currentTarget.querySelector<HTMLElement>('[data-carousel-slide]');
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        anchorX: event.clientX,
        // `offsetWidth` is 0 where there is no layout (tests); fall back to a typical card.
        stepWidth:
          (slide && slide.offsetWidth > 0 ? slide.offsetWidth : FALLBACK_CARD_WIDTH_PX) *
          DRAG_STEP_SHARE,
      };
      suppressClick.current = false;
    },

    onPointerMove(event) {
      const state = drag.current;
      if (state?.pointerId !== event.pointerId) {
        return;
      }
      if (Math.abs(event.clientX - state.startX) > CLICK_SLOP_PX) {
        suppressClick.current = true;
      }

      // Every `stepWidth` of travel moves one card; dragging right brings the previous card in.
      const travelled = event.clientX - state.anchorX;
      if (Math.abs(travelled) >= state.stepWidth) {
        const steps = Math.trunc(travelled / state.stepWidth);
        state.anchorX += steps * state.stepWidth;
        onStep(-steps);
      }
    },

    onPointerUp: endDrag,
    onPointerCancel: endDrag,

    onClickCapture(event) {
      if (suppressClick.current) {
        suppressClick.current = false;
        event.preventDefault();
        event.stopPropagation();
      }
    },

    onWheel(event) {
      if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) {
        return;
      }
      const now = performance.now();
      const state = wheel.current;
      if (now < state.lockedUntil) {
        return;
      }
      state.distance += event.deltaX;
      if (Math.abs(state.distance) >= WHEEL_STEP_PX) {
        onStep(Math.sign(state.distance));
        state.distance = 0;
        state.lockedUntil = now + WHEEL_LOCK_MS;
      }
    },
  };
}
