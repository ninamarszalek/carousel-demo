import type { PipeableStream, RenderToPipeableStreamOptions } from 'react-dom/server';

import type { FilmsApi } from './films-api';

/**
 * The contract between the Express server (`server/render.ts`) and the SSR entry
 * (`src/entry-server.tsx`). It lives in `src/types` because that is the only part of `src` the
 * server may import. The server never imports the entry itself: it loads it at runtime.
 */

/** What the server hands to the SSR entry for every request. */
export interface SsrContext {
  /** Server-side data access (TMDB), created once per process. */
  films: FilmsApi;
  /** Per-request Content Security Policy nonce for inline scripts. */
  nonce: string;
}

export type SsrResult =
  /** The router answered with a Response (redirect after a form post, 405, …). Sent as-is. */
  | { kind: 'response'; response: Response }
  /** The data is loaded; the server starts the stream with its own callbacks. */
  | {
      kind: 'render';
      statusCode: number;
      /** Escaped tags for `<head>` (title, description, Open Graph, canonical link). */
      head: string;
      render: (options: RenderToPipeableStreamOptions) => PipeableStream;
    };

export interface SsrEntry {
  handle: (request: Request, context: SsrContext) => Promise<SsrResult>;
}
