import { http, HttpResponse } from 'msw';

import { resolveTmdbRequest } from './resolve';

export const TMDB_TEST_BASE_URL = 'https://api.themoviedb.org/3';
export const TMDB_TEST_TOKEN = 'test-token';

/** MSW handlers that answer TMDB from the fixtures. Requests without the test token get 401. */
export const tmdbHandlers = [
  http.get(`${TMDB_TEST_BASE_URL}/*`, ({ request }) => {
    if (request.headers.get('Authorization') !== `Bearer ${TMDB_TEST_TOKEN}`) {
      return HttpResponse.json(
        { status_code: 7, status_message: 'Invalid API key' },
        { status: 401 },
      );
    }
    const url = new URL(request.url);
    const { status, body } = resolveTmdbRequest(
      url.pathname.slice(new URL(TMDB_TEST_BASE_URL).pathname.length),
      url.searchParams,
    );
    return HttpResponse.json(body, { status });
  }),
];
