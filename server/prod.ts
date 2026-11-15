/**
 * Production entry point, built to `dist/server/index.js`.
 *
 * React and Express choose their production code paths based on NODE_ENV when they are first
 * loaded, so it is set before they are imported (hence the dynamic import below).
 * This also keeps `npm start` cross-platform: no `NODE_ENV=production` prefix needed.
 */
import { run } from './lifecycle';

process.env.NODE_ENV = 'production';

run(async () => {
  const { startProductionServer } = await import('./production');

  // Paths are resolved relative to this file, which always sits in `dist/server/` after the build.
  await startProductionServer({
    clientDir: new URL('../client/', import.meta.url),
    ssrEntry: new URL('./entry-server.js', import.meta.url),
  });
});
