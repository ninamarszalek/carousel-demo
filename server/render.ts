import { Writable } from 'node:stream';

import type { RequestHandler, Response } from 'express';
import { isbot } from 'isbot';
import type { PipeableStream, RenderToPipeableStreamOptions } from 'react-dom/server';

/** Contract of `src/entry-server.tsx`, used by both the dev (Vite) and the production server. */
export interface SsrEntry {
  render: (url: string, options: RenderToPipeableStreamOptions) => PipeableStream;
}

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
  /**
   * After this time React stops waiting for pending Suspense boundaries: users get the rest
   * rendered on the client, bots get whatever is ready (with status 500).
   */
  timeoutMs?: number;
}

const DEFAULT_RENDER_TIMEOUT_MS = 10_000;

/** Splits the template into the parts written before and after the React stream. */
export function splitTemplate(template: string, head = ''): [before: string, after: string] {
  const parts = template.replace(HEAD_PLACEHOLDER, head).split(HTML_PLACEHOLDER);
  if (parts.length !== 2 || parts[0] === undefined || parts[1] === undefined) {
    throw new Error(`HTML template must contain exactly one ${HTML_PLACEHOLDER} placeholder.`);
  }
  return [parts[0], parts[1]];
}

/**
 * Streams the React app into the HTML template.
 *
 * When the response starts depends on who is asking:
 * - **Users** get the shell as soon as it is ready (`onShellReady`): the page appears at once with
 *   Suspense fallbacks (skeletons), and the content streams in as it loads.
 * - **Bots** (search engines, link previews) get the response only when everything is ready
 *   (`onAllReady`): many of them do not run JavaScript, so streamed-in content would stay hidden,
 *   and `<head>` tags that depend on data (title, og:image) can only be filled in at this point.
 *   The content is the same for both, only the timing differs, so this is not cloaking.
 *
 * If the shell itself fails, the empty template is sent with status 500 and the client renders
 * the app from scratch (see `src/entry-client.tsx`), so the user still gets a working page.
 */
export function createRenderHandler(
  renderer: Renderer,
  { timeoutMs = DEFAULT_RENDER_TIMEOUT_MS }: RenderOptions = {},
): RequestHandler {
  return async (req, res, next) => {
    const url = req.originalUrl;

    let template: string;
    let entry: SsrEntry;
    try {
      [template, entry] = await Promise.all([renderer.getTemplate(url), renderer.loadEntry()]);
    } catch (error) {
      if (error instanceof Error) {
        renderer.fixStacktrace?.(error);
      }
      next(error);
      return;
    }

    const [before, after] = splitTemplate(template);
    const waitForAllContent = isbot(req.get('user-agent'));
    let hasRenderError = false;

    // The response differs by User-Agent, so caches and CDNs must not share it between them.
    res.vary('User-Agent');

    const sendResponse = (): void => {
      res.status(hasRenderError ? 500 : 200);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.write(before);
      stream.pipe(createResponseSink(res, after));
    };

    const stream = entry.render(url, {
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
