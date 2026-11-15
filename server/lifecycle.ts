import type { Server } from 'node:http';

import type { Express } from 'express';

import { ConfigError } from './config';

const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Runs a server entry point and exits with a readable message if startup fails. */
export function run(main: () => Promise<void>): void {
  main().catch((error: unknown) => {
    console.error(error instanceof ConfigError ? error.message : error);
    process.exit(1);
  });
}

/** Starts listening and closes the server gracefully on SIGINT / SIGTERM. */
export function listen(app: Express, port: number, onShutdown?: () => Promise<void>): Server {
  const server = app.listen(port, () => {
    console.log(`Server listening on http://localhost:${String(port)}`);
  });

  const shutdown = (signal: NodeJS.Signals): void => {
    console.log(`${signal} received, shutting down...`);

    setTimeout(() => {
      console.error('Graceful shutdown timed out, forcing exit.');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS).unref();

    server.close(() => {
      void Promise.resolve(onShutdown?.()).finally(() => {
        process.exit(0);
      });
    });
    server.closeIdleConnections();
  };

  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);

  return server;
}
