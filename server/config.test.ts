import { describe, expect, it } from 'vitest';

import { ConfigError, readConfig } from './config';

describe('readConfig', () => {
  it('reads a valid configuration', () => {
    expect(readConfig({ TMDB_ACCESS_TOKEN: 'token', PORT: '8080' })).toEqual({
      port: 8080,
      tmdbAccessToken: 'token',
    });
  });

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
