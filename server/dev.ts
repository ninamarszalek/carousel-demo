import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createServer as createViteServer, type ViteDevServer } from 'vite';

import { createApp } from './app';
import { loadEnvFile, readConfig } from './config';
import { listen, run } from './lifecycle';
import type { SsrEntry } from './render';
import { createFilmsApi } from './tmdb';

const SSR_ENTRY = '/src/entry-server.tsx';
const STYLE_FILE = /\.(?:css|scss)$/;

/**
 * `<link>` tags for every stylesheet the SSR entry imports. In development Vite injects component
 * styles from JavaScript, so without these the server-rendered HTML shows unstyled until the
 * client bundle runs. (A production build links all CSS from the HTML template.)
 */
async function collectStyleLinks(vite: ViteDevServer): Promise<string> {
  const graph = vite.environments.ssr.moduleGraph;
  const entry = await graph.getModuleByUrl(SSR_ENTRY);
  const urls = new Set<string>();
  const seen = new Set<unknown>();
  const visit = (mod: NonNullable<typeof entry>): void => {
    if (seen.has(mod)) {
      return;
    }
    seen.add(mod);
    if (STYLE_FILE.test(mod.url)) {
      urls.add(mod.url);
      return;
    }
    mod.importedModules.forEach(visit);
  };
  if (entry) {
    visit(entry);
  }
  return [...urls].map((url) => `<link rel="stylesheet" href="${url}" />`).join('\n');
}

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
        await vite.ssrLoadModule(SSR_ENTRY);
        const template = await readFile(path.join(root, 'index.html'), 'utf8');
        const html = await vite.transformIndexHtml(url, template);
        return html.replace('</head>', `${await collectStyleLinks(vite)}\n</head>`);
      },
      loadEntry: () => vite.ssrLoadModule(SSR_ENTRY) as Promise<SsrEntry>,
      fixStacktrace: (error) => {
        vite.ssrFixStacktrace(error);
      },
    },
  });

  listen(app, config.port, () => vite.close());
});
