import { describe, expect, it } from 'vitest';

import { ConfigError, readConfig } from './config';

describe('readConfig', () => {
  it('reads a valid configuration', () => {
    expect(
      readConfig({
        TMDB_ACCESS_TOKEN: 'token',
        PORT: '8080',
        TMDB_API_BASE_URL: 'http://localhost:4174/3',
      }),
    ).toEqual({
      port: 8080,
      tmdbAccessToken: 'token',
      tmdbApiBaseUrl: 'http://localhost:4174/3',
    });
  });

  it('defaults the TMDB API base URL to the public API', () => {
    expect(readConfig({ TMDB_ACCESS_TOKEN: 'token' }).tmdbApiBaseUrl).toBe(
      'https://api.themoviedb.org/3',
    );
  });

  it.each(['not a url', 'ftp://example.com'])(
    'rejects an invalid TMDB API base URL (%s)',
    (url) => {
      expect(() => readConfig({ TMDB_ACCESS_TOKEN: 'token', TMDB_API_BASE_URL: url })).toThrow(
        /TMDB_API_BASE_URL must be an http\(s\) URL/,
      );
    },
  );

  it('defaults the port to 3000', () => {
    expect(readConfig({ TMDB_ACCESS_TOKEN: 'token' }).port).toBe(3000);
  });

  it.each([undefined, '', '   '])('rejects a missing TMDB token (%j)', (token) => {
    expect(() => readConfig({ TMDB_ACCESS_TOKEN: token })).toThrow(ConfigError);
    expect(() => readConfig({ TMDB_ACCESS_TOKEN: token })).toThrow(/TMDB_ACCESS_TOKEN is missing/);
  });

  it.each(['abc', '0', '70000', '3000.5'])('rejects an invalid port (%s)', (port) => {
    expect(() => readConfig({ TMDB_ACCESS_TOKEN: 'token', PORT: port })).toThrow(
      /PORT must be an integer/,
    );
  });

  it('reports all problems at once', () => {
    expect(() => readConfig({ PORT: 'abc' })).toThrow(/TMDB_ACCESS_TOKEN[\s\S]*PORT/);
  });
});
