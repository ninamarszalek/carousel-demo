import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createServer as createViteServer } from 'vite';

import { createApp } from './app';
import { loadEnvFile, readConfig } from './config';
import { listen, run } from './lifecycle';
import type { SsrEntry } from './render';
import { createFilmsApi } from './tmdb';

/** Development server: Vite runs as middleware (HMR, on-the-fly transforms, SSR module loading). */
run(async () => {
  loadEnvFile();
  const config = readConfig(process.env);

  const root = path.resolve(import.meta.dirname, '..');
  const vite = await createViteServer({
    root,
    server: { middlewareMode: true },
    appType: 'custom',
  });

  const app = createApp({
    mode: 'development',
    films: createFilmsApi(config),
    middleware: [vite.middlewares],
    renderer: {
      getTemplate: async (url) => {
        const template = await readFile(path.join(root, 'index.html'), 'utf8');
        return vite.transformIndexHtml(url, template);
      },
      loadEntry: () => vite.ssrLoadModule('/src/entry-server.tsx') as Promise<SsrEntry>,
      fixStacktrace: (error) => {
        vite.ssrFixStacktrace(error);
      },
    },
  });

  listen(app, config.port, () => vite.close());
});
