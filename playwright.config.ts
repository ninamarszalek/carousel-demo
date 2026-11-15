import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const TMDB_MOCK_PORT = 4174;
const isCI = Boolean(process.env.CI);

/**
 * E2E tests run against the production build (`npm run build` must run first,
 * `npm run test:e2e` does it for you), so they exercise the real SSR output.
 * TMDB is replaced by a local mock serving the shared fixtures (tests/mocks/tmdb), so the tests
 * need no token and always see the same films.
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
  webServer: [
    {
      command: `npx tsx tests/e2e/tmdb-mock-server.ts ${String(TMDB_MOCK_PORT)}`,
      url: `http://localhost:${String(TMDB_MOCK_PORT)}/healthz`,
      reuseExistingServer: !isCI,
    },
    {
      command: 'node dist/server/index.js',
      url: `http://localhost:${String(PORT)}/healthz`,
      reuseExistingServer: !isCI,
      env: {
        PORT: String(PORT),
        TMDB_ACCESS_TOKEN: process.env.TMDB_ACCESS_TOKEN ?? 'e2e-placeholder-token',
        TMDB_API_BASE_URL: `http://localhost:${String(TMDB_MOCK_PORT)}/3`,
      },
    },
  ],
});
