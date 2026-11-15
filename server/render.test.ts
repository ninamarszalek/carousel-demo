import express from 'express';
import { createElement, Suspense, use, type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SsrContext, SsrEntry, SsrResult } from '@/types/ssr';

import { createFakeFilmsApi } from '../tests/mocks/fake-films-api';
import { cspNonce } from './csp';
import { createRenderHandler, splitTemplate } from './render';

const TEMPLATE =
  '<!doctype html><html><head><!--app-head--></head><body><div id="root"><!--app-html--></div></body></html>';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const GOOGLEBOT_UA = 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
const SLACKBOT_UA = 'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)';

/** A page with one Suspense boundary that waits for `content`, like a carousel waiting for TMDB. */
function pageWithPendingContent(content: Promise<string>): ReactNode {
  function SlowContent(): ReactNode {
    return createElement('p', null, use(content));
  }
  return createElement(
    'main',
    null,
    createElement('h1', null, 'Films'),
    createElement(
      Suspense,
      { fallback: createElement('p', null, 'Loading...') },
      createElement(SlowContent),
    ),
  );
}

function resolveAfter(ms: number, value: string): Promise<string> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(value);
    }, ms);
  });
}

const films = createFakeFilmsApi();

/** An SSR entry that renders `element` with the given status and head, like entry-server does. */
function renderingEntry(element: ReactNode, statusCode = 200, head = ''): SsrEntry {
  return {
    handle: () =>
      Promise.resolve({
        kind: 'render',
        statusCode,
        head,
        render: (options) => renderToPipeableStream(element, options),
      }),
  };
}

function createTestServer(entry: SsrEntry | ReactNode, { timeoutMs }: { timeoutMs?: number } = {}) {
  const ssrEntry =
    typeof entry === 'object' && entry !== null && 'handle' in entry
      ? entry
      : renderingEntry(entry);

  return express()
    .use(cspNonce)
    .use(
      createRenderHandler(
        {
          getTemplate: () => Promise.resolve(TEMPLATE),
          loadEntry: () => Promise.resolve(ssrEntry),
        },
        { films, ...(timeoutMs !== undefined && { timeoutMs }) },
      ),
    );
}

describe('splitTemplate', () => {
  it('splits the template around the app placeholder and injects the head', () => {
    const template = '<head><!--app-head--></head><div id="root"><!--app-html--></div>';

    expect(splitTemplate(template, '<title>Film</title>')).toEqual([
      '<head><title>Film</title></head><div id="root">',
      '</div>',
    ]);
  });

  it.each(['<div id="root"></div>', '<!--app-html--><!--app-html-->'])(
    'throws when the template does not contain exactly one app placeholder (%s)',
    (template) => {
      expect(() => splitTemplate(template)).toThrow(/exactly one <!--app-html--> placeholder/);
    },
  );
});

describe('createRenderHandler: response timing for users and bots', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends users the shell first, with the fallback, and streams the content in later', async () => {
    const app = createTestServer(pageWithPendingContent(resolveAfter(20, 'Loaded content')));

    const response = await request(app).get('/').set('User-Agent', BROWSER_UA);

    expect(response.status).toBe(200);
    // The fallback is part of the shell; the content arrives later in a hidden chunk.
    expect(response.text).toContain('<p>Loading...</p>');
    expect(response.text).toContain('Loaded content');
  });

  it.each([
    ['Googlebot', GOOGLEBOT_UA],
    ['Slackbot', SLACKBOT_UA],
  ])('waits for all content before responding to %s', async (_name, userAgent) => {
    const app = createTestServer(pageWithPendingContent(resolveAfter(20, 'Loaded content')));

    const response = await request(app).get('/').set('User-Agent', userAgent);

    expect(response.status).toBe(200);
    expect(response.text).toContain('<p>Loaded content</p>');
    expect(response.text).not.toContain('Loading...');
  });

  it('treats requests without a User-Agent as users', async () => {
    const app = createTestServer(pageWithPendingContent(resolveAfter(20, 'Loaded content')));

    const response = await request(app).get('/').unset('User-Agent');

    expect(response.text).toContain('<p>Loading...</p>');
  });

  it('marks the response as User-Agent dependent for caches', async () => {
    const app = createTestServer(createElement('p', null, 'Hello'));

    const response = await request(app).get('/').set('User-Agent', BROWSER_UA);

    expect(response.headers.vary).toContain('User-Agent');
  });

  it('sends a bot what is ready when the content takes too long, with status 500', async () => {
    const neverResolves = new Promise<string>(() => undefined);
    const app = createTestServer(pageWithPendingContent(neverResolves), { timeoutMs: 50 });

    const response = await request(app).get('/').set('User-Agent', GOOGLEBOT_UA);

    expect(response.status).toBe(500);
    expect(response.text).toContain('<h1>Films</h1>');
    expect(response.text).toContain('Loading...');
  });

  it('falls back to the empty shell for bots too when the shell fails', async () => {
    function Broken(): ReactNode {
      throw new Error('render failed');
    }
    const app = createTestServer(createElement(Broken));

    const response = await request(app).get('/').set('User-Agent', GOOGLEBOT_UA);

    expect(response.status).toBe(500);
    expect(response.text).toContain('<div id="root"></div>');
  });
});

describe('createRenderHandler: router integration', () => {
  it('passes the request, the server FilmsApi and the CSP nonce to the SSR entry', async () => {
    let received: { request: Request; context: SsrContext } | undefined;
    const entry: SsrEntry = {
      handle: (fetchRequest, context) => {
        received = { request: fetchRequest, context };
        return renderingEntry(null).handle(fetchRequest, context);
      },
    };

    await request(createTestServer(entry))
      .get('/film/603?category=action')
      .set('Cookie', 'wishlist=603');

    expect(received?.request.url).toMatch(/\/film\/603\?category=action$/);
    expect(received?.request.headers.get('cookie')).toBe('wishlist=603');
    expect(received?.context.films).toBe(films);
    expect(received?.context.nonce).toMatch(/^[\w+/]+=*$/);
  });

  it('uses the status code and head tags from the router', async () => {
    const entry = renderingEntry(
      createElement('h1', null, 'Not found'),
      404,
      '<title>Nope</title>',
    );

    const response = await request(createTestServer(entry)).get('/film/999999');

    expect(response.status).toBe(404);
    expect(response.text).toContain('<head><title>Nope</title></head>');
    expect(response.text).toContain('<h1>Not found</h1>');
  });

  it('sends responses from the router as they are (e.g. the redirect after a form post)', async () => {
    const headers = new Headers({ Location: '/film/603' });
    headers.append('Set-Cookie', 'wishlist=603; Path=/');
    const entry: SsrEntry = {
      handle: () =>
        Promise.resolve<SsrResult>({
          kind: 'response',
          response: new Response(null, { status: 303, headers }),
        }),
    };

    const response = await request(createTestServer(entry)).post('/film/603').send('intent=add');

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/film/603');
    expect(response.headers['set-cookie']).toStrictEqual(['wishlist=603; Path=/']);
  });

  it('gives the nonce to React for its inline scripts', async () => {
    const app = createTestServer(pageWithPendingContent(resolveAfter(20, 'Loaded content')));

    const response = await request(app).get('/').set('User-Agent', BROWSER_UA);

    expect(response.text).toMatch(/<script nonce="[^"]+">/);
  });

  it('marks pages as private and dependent on User-Agent and Cookie', async () => {
    const response = await request(createTestServer(null)).get('/');

    expect(response.headers['cache-control']).toBe('private, no-cache');
    expect(response.headers.vary).toBe('User-Agent, Cookie');
  });

  it.each(['PUT', 'DELETE', 'PATCH'] as const)('rejects %s with 405', async (method) => {
    const app = createTestServer(null);

    const response = await request(app)[method.toLowerCase() as 'put' | 'delete' | 'patch']('/');

    expect(response.status).toBe(405);
    expect(response.headers.allow).toBe('GET, HEAD, POST');
  });

  it('rejects cross-site form posts', async () => {
    const response = await request(createTestServer(null))
      .post('/film/603')
      .set('Sec-Fetch-Site', 'cross-site')
      .send('intent=add');

    expect(response.status).toBe(403);
  });

  it('rejects large form posts', async () => {
    const response = await request(createTestServer(null)).post('/film/603').send('x'.repeat(4096));

    expect(response.status).toBe(413);
  });

  it('passes errors of the SSR entry to the error handler', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const entry: SsrEntry = { handle: () => Promise.reject(new Error('router failed')) };
    const app = createTestServer(entry).use(
      (error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
        res.status(500).send(error.message);
      },
    );

    const response = await request(app).get('/');

    expect(response.status).toBe(500);
    expect(response.text).toBe('router failed');
    vi.restoreAllMocks();
  });
});
