import { useEffect, useState, type RefObject } from 'react';

const THRESHOLDS = [0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9, 1];

/**
 * Which child of `container` (matched by `selector`) is the most on screen, by the value of its
 * `data-key` attribute. `null` until it has been measured (on the server, during hydration, and
 * where `IntersectionObserver` is missing), so callers can render a neutral state first.
 */
export function useMostVisible(
  container: RefObject<HTMLElement | null>,
  selector: string,
): string | null {
  const [mostVisible, setMostVisible] = useState<string | null>(null);

  useEffect(() => {
    const root = container.current;
    if (!root || typeof IntersectionObserver !== 'function') {
      return;
    }

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const key = (entry.target as HTMLElement).dataset.key;
          if (key !== undefined) {
            ratios.set(key, entry.intersectionRatio);
          }
        }
        let best: string | null = null;
        let bestRatio = 0;
        for (const [key, ratio] of ratios) {
          if (ratio > bestRatio) {
            best = key;
            bestRatio = ratio;
          }
        }
        if (best !== null) {
          setMostVisible(best);
        }
      },
      { threshold: THRESHOLDS },
    );

    root.querySelectorAll(selector).forEach((element) => {
      observer.observe(element);
    });
    return () => {
      observer.disconnect();
    };
  }, [container, selector]);

  return mostVisible;
}
