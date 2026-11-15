import type { FilmsApi } from '@/types/films-api';

import type { ServerConfig } from '../config';
import { createCache } from './cache';
import { createTmdbClient } from './client';
import { createTmdbFilmsApi } from './films-service';

/** Wires the TMDB client and cache into the server-side `FilmsApi`. */
export function createFilmsApi(config: ServerConfig): FilmsApi {
  const client = createTmdbClient({
    baseUrl: config.tmdbApiBaseUrl,
    accessToken: config.tmdbAccessToken,
  });
  return createTmdbFilmsApi(client, createCache());
}
