import { Writable } from 'node:stream';

import type { RequestHandler, Response } from 'express';
import { isbot } from 'isbot';

import type { FilmsApi } from '@/types/films-api';
import type { SsrEntry, SsrResult } from '@/types/ssr';

import { getCspNonce } from './csp';
import { PayloadTooLargeError, sendFetchResponse, toFetchRequest } from './http/fetch-bridge';

export type { SsrEntry } from '@/types/ssr';

/** Mode-specific way of getting the HTML template and the SSR entry. */
export interface Renderer {
  /** Dev: re-read and transformed by Vite on every request. Prod: read once at startup. */
  getTemplate: (url: string) => Promise<string>;
  loadEntry: () => Promise<SsrEntry>;
  /** Dev only: maps SSR stack traces back to the original source files. */
  fixStacktrace?: (error: Error) => void;
}

export const HEAD_PLACEHOLDER = '<!--app-head-->';
export const HTML_PLACEHOLDER = '<!--app-html-->';

export interface RenderOptions {
  /** Server-side data access handed to the SSR entry. */
  films: FilmsApi;
  /**
   * After this time React stops waiting for pending Suspense boundaries: users get the rest
   * rendered on the client, bots get whatever is ready (with status 500).
   */
  timeoutMs?: number;
}

const DEFAULT_RENDER_TIMEOUT_MS = 10_000;

/** Methods pages accept: GET/HEAD to render, POST for form actions (works without JavaScript). */
const PAGE_METHODS = new Set(['GET', 'HEAD', 'POST']);

/** Splits the template into the parts written before and after the React stream. */
export function splitTemplate(template: string, head = ''): [before: string, after: string] {
  const parts = template.replace(HEAD_PLACEHOLDER, head).split(HTML_PLACEHOLDER);
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new Error(`HTML template must contain exactly one ${HTML_PLACEHOLDER} placeholder.`);
  }
  return [parts[0], parts[1]];
}

/**
 * Renders pages: turns the request into a Fetch `Request`, lets the SSR entry run the router
 * (loaders, actions, status code, head tags), then streams the React app into the HTML template.
 *
 * When the response starts depends on who is asking:
 * - **Users** get the shell as soon as it is ready (`onShellReady`): the page appears at once with
 *   Suspense fallbacks (skeletons), and the content streams in as it loads.
 * - **Bots** (search engines, link previews) get the response only when everything is ready
 *   (`onAllReady`): many of them do not run JavaScript, so streamed-in content would stay hidden.
 *   The content is the same for both, only the timing differs, so this is not cloaking.
 *
 * If the shell itself fails, the empty template is sent with status 500 and the client renders
 * the app from scratch (see `src/entry-client.tsx`), so the user still gets a working page.
 */
export function createRenderHandler(
  renderer: Renderer,
  { films, timeoutMs = DEFAULT_RENDER_TIMEOUT_MS }: RenderOptions,
): RequestHandler {
  return async (req, res, next) => {
    if (!PAGE_METHODS.has(req.method)) {
      res
        .set('Allow', [...PAGE_METHODS].join(', '))
        .status(405)
        .type('text/plain');
      res.send('Method Not Allowed');
      return;
    }
    // Cheap CSRF guard for form posts. Browsers send this header on every request they make.
    if (req.method === 'POST' && req.get('sec-fetch-site') === 'cross-site') {
      res.status(403).type('text/plain').send('Forbidden');
      return;
    }

    const url = req.originalUrl;

    let template: string;
    let result: SsrResult;
    try {
      const request = await toFetchRequest(req, res);
      const [loadedTemplate, entry] = await Promise.all([
        renderer.getTemplate(url),
        renderer.loadEntry(),
      ]);
      template = loadedTemplate;
      result = await entry.handle(request, { films, nonce: getCspNonce(res) });
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        res.status(413).type('text/plain').send('Payload Too Large');
        return;
      }
      if (error instanceof Error) {
        renderer.fixStacktrace?.(error);
      }
      next(error);
      return;
    }

    if (result.kind === 'response') {
      await sendFetchResponse(res, result.response);
      return;
    }

    const [before, after] = splitTemplate(template, result.head);
    const waitForAllContent = isbot(req.get('user-agent'));
    let hasRenderError = false;

    // The response differs by User-Agent (timing) and by Cookie (the wish list in the header),
    // so caches must not share it between visitors.
    res.vary('User-Agent').vary('Cookie');
    res.setHeader('Cache-Control', 'private, no-cache');

    const sendResponse = (): void => {
      res.status(hasRenderError ? 500 : result.statusCode);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.write(before);
      stream.pipe(createResponseSink(res, after));
    };

    const stream = result.render({
      nonce: getCspNonce(res),
      onShellReady() {
        if (!waitForAllContent) {
          sendResponse();
        }
      },
      onAllReady() {
        if (waitForAllContent) {
          sendResponse();
        }
      },
      onShellError(error) {
        logRenderError(error);
        res.status(500).setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end(before + after);
      },
      onError(error) {
        hasRenderError = true;
        logRenderError(error);
      },
    });

    // Aborting turns pending boundaries into client-rendered ones and then fires `onAllReady`,
    // so a bot still gets everything that was ready instead of a hanging request.
    const timeout = setTimeout(() => {
      stream.abort();
    }, timeoutMs);
    res.on('close', () => {
      clearTimeout(timeout);
    });
  };
}

/**
 * React ends the stream it pipes into, so we pipe into a sink that forwards chunks to the response
 * and appends the rest of the template at the end. `flush` lets React push streamed chunks through
 * the `compression` middleware instead of waiting for its buffer to fill.
 */
function createResponseSink(res: Response, after: string): Writable {
  const sink = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      res.write(chunk);
      callback();
    },
    final(callback) {
      res.end(after);
      callback();
    },
  });

  return Object.assign(sink, {
    flush: () => {
      (res as Partial<{ flush: () => void }>).flush?.();
    },
  });
}

function logRenderError(error: unknown): void {
  console.error('[ssr] render error:', error);
}
