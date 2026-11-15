import { createElement, type ReactNode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createApp, type ServerMode } from './app';
import type { Renderer } from './render';

const TEMPLATE =
  '<!doctype html><html><head><!--app-head--></head><body><div id="root"><!--app-html--></div></body></html>';

function Broken(): ReactNode {
  throw new Error('render failed');
}

function createTestApp(
  element: ReactNode,
  overrides: Partial<Renderer> = {},
  mode: ServerMode = 'production',
) {
  return createApp({
    mode,
    renderer: {
      getTemplate: () => Promise.resolve(TEMPLATE),
      loadEntry: () =>
        Promise.resolve({ render: (_url, options) => renderToPipeableStream(element, options) }),
      ...overrides,
    },
  });
}

describe('server app', () => {
  beforeEach(() => {
    // Error paths are expected in some tests; keep the test output clean.
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('responds to the health check', async () => {
    const response = await request(createTestApp(null)).get('/healthz');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('returns JSON 404 for unknown API routes instead of rendering a page', async () => {
    const response = await request(createTestApp(null)).get('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: 'Not found' });
  });

  it('streams the rendered app into the HTML template', async () => {
    const response = await request(createTestApp(createElement('p', null, 'Hello SSR'))).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(response.text).toContain('<div id="root"><p>Hello SSR</p></div>');
    expect(response.text).not.toContain('<!--app-head-->');
  });

  it('falls back to the empty shell with status 500 when the app shell fails to render', async () => {
    const response = await request(createTestApp(createElement(Broken))).get('/');

    expect(response.status).toBe(500);
    expect(response.text).toContain('<div id="root"></div>');
  });

  it('responds with 500 when the template cannot be loaded', async () => {
    const app = createTestApp(null, {
      getTemplate: () => Promise.reject(new Error('missing template')),
    });

    const response = await request(app).get('/');

    expect(response.status).toBe(500);
    expect(response.text).toBe('Internal Server Error');
  });

  it('sets security headers and hides the framework', async () => {
    const response = await request(createTestApp(null)).get('/healthz');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toContain('img-src');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });

  it('disables the Content Security Policy in development (Vite injects inline scripts)', async () => {
    const response = await request(createTestApp(null, {}, 'development')).get('/healthz');

    expect(response.headers['content-security-policy']).toBeUndefined();
  });
});
