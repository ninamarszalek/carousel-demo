import { test as base, expect, type Page } from '@playwright/test';

/** A 1×1 transparent PNG served for every TMDB image, so tests never reach image.tmdb.org. */
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

interface Fixtures {
  /** Console errors and uncaught exceptions; checked after every test (hydration, CSP, …). */
  consoleErrors: string[];
}

/**
 * Every test: TMDB images are stubbed, and the test fails if the page logs an error. That catches
 * hydration mismatches and CSP violations, which do not break the page visibly.
 */
export const test = base.extend<Fixtures>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(message.text());
        }
      });
      page.on('pageerror', (error) => errors.push(error.message));
      await page.route('https://image.tmdb.org/**', (route) =>
        route.fulfill({ contentType: 'image/png', body: PIXEL }),
      );

      await use(errors);

      expect(errors).toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Waits until React has hydrated, so clicks are handled by the router (not full page loads). */
export async function waitForHydration(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root !== null && Object.keys(root).some((key) => key.startsWith('__reactContainer'));
  });
}
