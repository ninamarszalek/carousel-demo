import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '../mocks/server';

// Pages wait for their route loaders; the default 1 s for `findBy*` is too tight on a busy CI
// machine, where the first test in a file also pays for module transforms.
configure({ asyncUtilTimeout: 3000 });

// Any request without a mock fails the test, so tests never hit the real network by accident.
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
