import { Writable } from 'node:stream';

import { describe, expect, it } from 'vitest';

import { FilmServiceError, type FilmsApi } from '@/types/films-api';
import type { SsrResult } from '@/types/ssr';

import { createFakeFilmsApi } from '../tests/mocks/fake-films-api';
import { MULTI_GENRE_FILM_ID, UNKNOWN_FILM_ID } from '../tests/mocks/tmdb/fixtures';
import { handle } from './entry-server';

const NONCE = 'test-nonce';
const films = createFakeFilmsApi();

interface RequestOptions {
  method?: 'GET' | 'POST';
  cookie?: string;
  body?: string;
  api?: FilmsApi;
}

function handleRequest(
  path: string,
  { method = 'GET', cookie, body, api = films }: RequestOptions = {},
): Promise<SsrResult> {
  const headers = new Headers(cookie ? { Cookie: cookie } : {});
  if (body !== undefined) {
    headers.set('Content-Type', 'application/x-www-form-urlencoded');
  }
  const request = new Request(`http://localhost${path}`, {
    method,
    headers,
    ...(body !== undefined && { body }),
  });
  return handle(request, { films: api, nonce: NONCE });
}

/** Renders like the server does for bots: waits for everything, then collects the HTML. */
async function renderPage(path: string, options?: RequestOptions) {
  const result = await handleRequest(path, options);
  if (result.kind !== 'render') {
    throw new Error(`Expected a page, got a ${String(result.response.status)} response.`);
  }

  const html = await new Promise<string>((resolve, reject) => {
    let output = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
      final(callback) {
        resolve(output);
        callback();
      },
    });
    const stream = result.render({
      nonce: NONCE,
      onAllReady() {
        stream.pipe(sink);
      },
      onShellError: reject,
      onError: reject,
    });
  });

  return { status: result.statusCode, head: result.head, html };
}

describe('entry-server handle()', () => {
  describe('homepage', () => {
    it('renders the three categories with their films', async () => {
      const { status, html } = await renderPage('/');

      expect(status).toBe(200);
      expect(html).toContain('<h1 class="home-page__title">Browse films</h1>');
      for (const label of ['Action', 'Comedy', 'Horror']) {
        expect(html).toContain(`>${label}</h2>`);
      }
      expect(html).toContain('The Matrix');
      expect(html).toContain('href="/film/603?category=action"');
    });

    it('serializes the loader data for hydration, with the nonce', async () => {
      const { html } = await renderPage('/');

      expect(html).toContain(`<script nonce="${NONCE}">window.__staticRouterHydrationData`);
    });

    it('escapes data so a film title cannot break out of the hydration script', async () => {
      const evilTitle = '</script><script>alert(1)</script>';
      const api = createFakeFilmsApi({
        getFilmsByGenre: () =>
          Promise.resolve([
            {
              id: 1,
              title: evilTitle,
              posterPath: null,
              releaseYear: null,
              rating: null,
              genreIds: [],
            },
          ]),
      });

      const { html } = await renderPage('/', { api });

      expect(html).not.toContain(evilTitle);
      expect(html).not.toContain('<script>alert(1)');
    });

    it('shows an error in one row when only that category fails', async () => {
      const api = createFakeFilmsApi({
        getFilmsByGenre: (genreId) =>
          genreId === 35
            ? Promise.reject(new FilmServiceError('TMDB down', 503))
            : films.getFilmsByGenre(genreId),
      });

      const { status, html } = await renderPage('/', { api });

      expect(status).toBe(200);
      expect(html).toContain('Couldn&#x27;t load comedy films.');
      expect(html).toContain('The Matrix');
    });

    it('becomes a 502 page when every category fails', async () => {
      const api = createFakeFilmsApi({
        getFilmsByGenre: () => Promise.reject(new FilmServiceError('TMDB down', null)),
      });

      const { status, head, html } = await renderPage('/', { api });

      expect(status).toBe(502);
      expect(head).toContain('<title>Something went wrong · Film Browser</title>');
      expect(html).toContain('Couldn&#x27;t load films. Please try again in a moment.');
    });
  });

  describe('film page', () => {
    it('renders the film with head tags for link previews', async () => {
      const { status, head, html } = await renderPage('/film/603?category=action');

      expect(status).toBe(200);
      expect(html).toContain('<h1 class="film-page__title">The Matrix</h1>');
      expect(head).toContain('<title>The Matrix (1999) · Film Browser</title>');
      expect(head).toContain('<meta name="description" content="Set in the 22nd century');
      expect(head).toContain(
        '<meta property="og:image" content="https://image.tmdb.org/t/p/w1280/backdrop-603.jpg" />',
      );
      expect(head).toContain('<link rel="canonical" href="/film/603" />');
    });

    it.each([
      [
        'the category from the URL',
        `/film/${String(MULTI_GENRE_FILM_ID)}?category=comedy`,
        'comedy',
      ],
      ['the first matching genre without one', `/film/${String(MULTI_GENRE_FILM_ID)}`, 'action'],
      ['the genres when the URL category is invalid', '/film/419430?category=drama', 'horror'],
    ])('is shown in %s', async (_name, path, category) => {
      const { html } = await renderPage(path);

      expect(html).toContain(`data-category="${category}"`);
    });

    it.each([
      ['an unknown film', `/film/${String(UNKNOWN_FILM_ID)}`],
      ['an invalid id', '/film/abc'],
      ['an unknown path', '/no/such/page'],
    ])('responds 404 for %s', async (_name, path) => {
      const { status, head, html } = await renderPage(path);

      expect(status).toBe(404);
      expect(head).toContain('<title>Page not found · Film Browser</title>');
      expect(html).toContain('Page not found</h1>');
      // The layout stays around the error page.
      expect(html).toContain('class="app__header"');
    });

    it('renders the wish list button as a form that posts back to the page', async () => {
      const { html } = await renderPage('/film/603?category=action');

      expect(html).toContain('action="/film/603?category=action" method="post"');
      expect(html).toContain('name="intent" value="add"');
      expect(html).toContain('aria-pressed="false"');
    });

    it('shows the film as already on the wish list', async () => {
      const { html } = await renderPage('/film/603', { cookie: 'wishlist=603%3Aaction' });

      expect(html).toContain('Remove from wish list');
      expect(html).toContain('aria-label="Wish list, 1 film"');
    });
  });

  describe('wish list', () => {
    it('adds a film with a form post and redirects back with the new cookie', async () => {
      const result = await handleRequest('/film/603?category=action', {
        method: 'POST',
        cookie: 'wishlist=419430%3Ahorror',
        body: 'intent=add&filmId=603&category=action',
      });

      expect(result.kind).toBe('response');
      const response = (result as Extract<SsrResult, { kind: 'response' }>).response;
      expect(response.status).toBe(303);
      expect(response.headers.get('Location')).toBe('/film/603?category=action');
      expect(response.headers.get('Set-Cookie')).toMatch(
        /^wishlist=603%3Aaction%2C419430%3Ahorror; Path=\/; Max-Age=31536000; SameSite=Lax$/,
      );
    });

    it('rejects an invalid form post with 400', async () => {
      const { status } = await renderPage('/film/603', {
        method: 'POST',
        body: 'intent=steal&filmId=603',
      });

      expect(status).toBe(400);
    });

    it('renders the wish list page from the cookie', async () => {
      const { status, head, html } = await renderPage('/wishlist', {
        cookie: `wishlist=${encodeURIComponent(`419430:horror,603,${String(UNKNOWN_FILM_ID)}`)}`,
      });

      expect(status).toBe(200);
      expect(head).toContain('<title>Wish list · Film Browser</title>');
      expect(html).toContain('href="/film/419430?category=horror"');
      expect(html).toContain('href="/film/603"');
      // The unknown film is skipped.
      expect(html).toContain('2 films');
    });

    it('renders the empty state', async () => {
      const { html } = await renderPage('/wishlist');

      expect(html).toContain('No films yet.');
    });
  });
});
