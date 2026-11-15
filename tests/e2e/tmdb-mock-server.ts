/**
 * A tiny TMDB stand-in for the e2e tests: the production server is started with
 * `TMDB_API_BASE_URL` pointing here (see playwright.config.ts), so e2e runs need no TMDB token and
 * always see the same films. Run with `tsx tests/e2e/tmdb-mock-server.ts <port>`.
 */
import { createServer } from 'node:http';

import { resolveTmdbRequest } from '../mocks/tmdb/resolve';

export const TMDB_MOCK_PREFIX = '/3';

const port = Number(process.argv[2] ?? 4174);

createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${String(port)}`);

  if (url.pathname === '/healthz') {
    res.writeHead(200).end('ok');
    return;
  }

  const path = url.pathname.startsWith(TMDB_MOCK_PREFIX)
    ? url.pathname.slice(TMDB_MOCK_PREFIX.length)
    : url.pathname;
  const { status, body } = resolveTmdbRequest(path, url.searchParams);
  res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
}).listen(port, () => {
  process.stdout.write(
    `TMDB mock listening on http://localhost:${String(port)}${TMDB_MOCK_PREFIX}\n`,
  );
});
