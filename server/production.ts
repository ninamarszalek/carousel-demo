import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import compression from 'compression';
import express, { type RequestHandler } from 'express';

import { createApp } from './app';
import { loadEnvFile, readConfig } from './config';
import { listen } from './lifecycle';
import type { SsrEntry } from './render';

interface ProductionPaths {
  /** Output of the client build (`dist/client/`). */
  clientDir: URL;
  /** Output of the SSR build (`dist/server/entry-server.js`). */
  ssrEntry: URL;
}

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

export async function startProductionServer({
  clientDir,
  ssrEntry,
}: ProductionPaths): Promise<void> {
  loadEnvFile();
  const config = readConfig(process.env);

  const clientPath = fileURLToPath(clientDir);

  // Both are loaded once: the build output does not change while the server runs.
  const template = await readFile(path.join(clientPath, 'index.html'), 'utf8');
  const entry = (await import(ssrEntry.href)) as SsrEntry;

  const app = createApp({
    mode: 'production',
    middleware: [compression(), serveStaticAssets(clientPath)],
    renderer: {
      getTemplate: () => Promise.resolve(template),
      loadEntry: () => Promise.resolve(entry),
    },
  });

  listen(app, config.port);
}

/** Serves the client build. `index.html` is the SSR template, so it is never served as-is. */
function serveStaticAssets(clientPath: string): RequestHandler {
  const assetsPath = path.join(clientPath, 'assets');
  const serveStatic = express.static(clientPath, {
    index: false,
    setHeaders(res, filePath) {
      // Files in assets/ have content hashes in their names, so they can be cached forever.
      if (filePath.startsWith(assetsPath)) {
        res.setHeader('Cache-Control', `public, max-age=${String(ONE_YEAR_IN_SECONDS)}, immutable`);
      }
    },
  });

  return (req, res, next) => {
    if (req.path === '/index.html') {
      next();
      return;
    }
    void serveStatic(req, res, next);
  };
}
