import { describe, expect, it } from 'vitest';

import { FilmServiceError } from '@/types/films-api';

import { errorStatus, httpError, orBadGateway } from './http-error';

describe('httpError', () => {
  it('throws a React Router error response with the status', () => {
    expect(() => httpError(404, 'Film not found')).toThrow(
      expect.objectContaining({ data: 'Film not found', init: { status: 404 } }),
    );
  });
});

describe('orBadGateway', () => {
  it('returns the loaded value', async () => {
    await expect(orBadGateway(() => Promise.resolve('films'))).resolves.toBe('films');
  });

  it('turns a film service failure into a 502', async () => {
    const load = () => Promise.reject(new FilmServiceError('TMDB down', 503));

    await expect(orBadGateway(load)).rejects.toMatchObject({ init: { status: 502 } });
  });

  it('rethrows other errors untouched, so bugs stay visible', async () => {
    const bug = new TypeError('undefined is not a function');

    await expect(orBadGateway(() => Promise.reject(bug))).rejects.toBe(bug);
  });
});

describe('errorStatus', () => {
  it('treats anything that is not an error response as a 500', () => {
    // Error responses (404, 502, …) are covered by the route tests, where the router creates them.
    expect(errorStatus(new Error('bug'))).toBe(500);
    expect(errorStatus('oops')).toBe(500);
  });
});
