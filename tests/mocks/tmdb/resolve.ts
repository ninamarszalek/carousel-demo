import type { JsonBodyType } from 'msw';

import { discoverByGenre, movieDetails } from './fixtures';

export interface MockResponse {
  status: number;
  body: JsonBodyType;
}

const NOT_FOUND: MockResponse = {
  status: 404,
  body: {
    success: false,
    status_code: 34,
    status_message: 'The resource you requested could not be found.',
  },
};

/**
 * Answers a TMDB API request from the fixtures, like TMDB would. `path` is relative to the API
 * base URL, e.g. `/discover/movie`. Used by both the MSW handlers and the e2e mock server.
 */
export function resolveTmdbRequest(path: string, params: URLSearchParams): MockResponse {
  if (path === '/discover/movie') {
    const genre = Number(params.get('with_genres'));
    return { status: 200, body: discoverByGenre[genre] ?? { page: 1, results: [] } };
  }

  const movieMatch = /^\/movie\/(\d+)$/.exec(path);
  if (movieMatch) {
    const movie = movieDetails[Number(movieMatch[1])];
    return movie ? { status: 200, body: movie } : NOT_FOUND;
  }

  return NOT_FOUND;
}
