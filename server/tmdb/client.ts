import { FilmServiceError } from '@/types/films-api';

/** A failed TMDB call: network error, timeout, or an unexpected (non-404) status. */
export class TmdbError extends FilmServiceError {
  override readonly name = 'TmdbError';
}

export interface TmdbClientOptions {
  baseUrl: string;
  accessToken: string;
  timeoutMs?: number;
  /** Injected in tests. */
  fetch?: typeof fetch;
}

export interface TmdbClient {
  /** GETs a TMDB path. Resolves to `null` on 404; throws `TmdbError` on any other failure. */
  get<T>(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T | null>;
}

const DEFAULT_TIMEOUT_MS = 5_000;

/** Minimal TMDB v3 client: Bearer auth, English content, a timeout on every call. */
export function createTmdbClient({
  baseUrl,
  accessToken,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  fetch: fetchImpl = fetch,
}: TmdbClientOptions): TmdbClient {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;

  return {
    async get<T>(path: string, params: Record<string, string> = {}, signal?: AbortSignal) {
      const url = new URL(path.replace(/^\//, ''), base);
      url.search = new URLSearchParams({ language: 'en-US', ...params }).toString();

      // A closed client request or a slow TMDB must never keep a server request waiting.
      const timeout = AbortSignal.timeout(timeoutMs);
      const combinedSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;

      let response: Response;
      try {
        response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
          signal: combinedSignal,
        });
      } catch (error) {
        const reason = timeout.aborted ? 'timed out' : 'failed';
        throw new TmdbError(`TMDB request ${reason}: ${url.pathname}`, null, { cause: error });
      }

      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new TmdbError(
          `TMDB responded with ${String(response.status)}: ${url.pathname}`,
          response.status,
        );
      }

      return (await response.json()) as T;
    },
  };
}
