import express from 'express';
import { createElement, Suspense, use, type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRenderHandler, splitTemplate, type RenderOptions } from './render';

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

function createTestServer(element: ReactNode, options?: RenderOptions) {
  const app = express();
  app.use(
    createRenderHandler(
      {
        getTemplate: () => Promise.resolve(TEMPLATE),
        loadEntry: () =>
          Promise.resolve({
            render: (_url, renderOptions) => renderToPipeableStream(element, renderOptions),
          }),
      },
      options,
    ),
  );
  return app;
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
