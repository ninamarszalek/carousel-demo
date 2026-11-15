import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { TMDB_TEST_BASE_URL, TMDB_TEST_TOKEN } from '../../tests/mocks/tmdb/handlers';
import { setupTmdbServer } from '../../tests/mocks/tmdb/setup-tmdb-server';
import { createTmdbClient, TmdbError } from './client';

const server = setupTmdbServer();

function createClient(timeoutMs?: number) {
  return createTmdbClient({
    baseUrl: TMDB_TEST_BASE_URL,
    accessToken: TMDB_TEST_TOKEN,
    ...(timeoutMs !== undefined && { timeoutMs }),
  });
}

describe('createTmdbClient', () => {
  it('sends the Bearer token and English language, and returns the JSON body', async () => {
    let requestUrl: URL | undefined;
    let authorization: string | null = null;
    server.use(
      http.get(`${TMDB_TEST_BASE_URL}/movie/603`, ({ request }) => {
        requestUrl = new URL(request.url);
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({ id: 603 });
      }),
    );

    const body = await createClient().get('/movie/603', { append_to_response: 'credits' });

    expect(body).toStrictEqual({ id: 603 });
    expect(authorization).toBe(`Bearer ${TMDB_TEST_TOKEN}`);
    expect(requestUrl?.searchParams.get('language')).toBe('en-US');
    expect(requestUrl?.searchParams.get('append_to_response')).toBe('credits');
  });

  it('resolves to null when TMDB responds with 404', async () => {
    await expect(createClient().get('/movie/999999')).resolves.toBeNull();
  });

  it('throws a TmdbError with the status for other error responses', async () => {
    server.use(http.get(`${TMDB_TEST_BASE_URL}/*`, () => new HttpResponse(null, { status: 503 })));

    const error = await createClient()
      .get('/movie/603')
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(TmdbError);
    expect(error).toMatchObject({ status: 503 });
  });

  it('throws a TmdbError on network errors', async () => {
    server.use(http.get(`${TMDB_TEST_BASE_URL}/*`, () => HttpResponse.error()));

    await expect(createClient().get('/movie/603')).rejects.toThrow(/TMDB request failed/);
  });

  it('gives up after the timeout', async () => {
    server.use(
      http.get(`${TMDB_TEST_BASE_URL}/*`, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return HttpResponse.json({});
      }),
    );

    await expect(createClient(20).get('/movie/603')).rejects.toThrow(/TMDB request timed out/);
  });

  it('stops when the caller aborts', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(createClient().get('/movie/603', {}, controller.signal)).rejects.toThrow(
      TmdbError,
    );
  });
});
