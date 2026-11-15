import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { tmdbHandlers } from './handlers';

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/**
 * Starts an MSW server that answers TMDB from the fixtures, for the current test file.
 * Unhandled requests fail the test, so nothing reaches the real network. Local requests (supertest
 * calling the app under test) pass through.
 */
export function setupTmdbServer() {
  const server = setupServer(...tmdbHandlers);

  beforeAll(() => {
    server.listen({
      onUnhandledFrame({ frame, defaults }) {
        const { request } = frame.data as { request?: Request };
        if (request && LOCAL_HOSTS.has(new URL(request.url).hostname)) {
          return;
        }
        defaults.error();
        throw new Error('Unhandled request: tests must not reach the real network.');
      },
    });
  });
  afterEach(() => {
    server.resetHandlers();
    server.events.removeAllListeners();
  });
  afterAll(() => {
    server.close();
  });

  return server;
}
