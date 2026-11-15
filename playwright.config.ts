import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const isCI = Boolean(process.env.CI);

/**
 * E2E tests run against the production build (`npm run build` must run first,
 * `npm run test:e2e` does it for you), so they exercise the real SSR output.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${String(PORT)}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node dist/server/index.js',
    url: `http://localhost:${String(PORT)}/healthz`,
    reuseExistingServer: !isCI,
    env: {
      PORT: String(PORT),
      TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN ?? 'e2e-placeholder-token',
    },
  },
});
