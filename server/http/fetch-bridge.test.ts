import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { PayloadTooLargeError, sendFetchResponse, toFetchRequest } from './fetch-bridge';

/** An app that converts the request and echoes what the Fetch `Request` looks like. */
function createEchoApp() {
  return express().use(async (req, res) => {
    try {
      const fetchRequest = await toFetchRequest(req, res, { maxBodyBytes: 16 });
      res.json({
        url: fetchRequest.url,
        method: fetchRequest.method,
        cookie: fetchRequest.headers.get('cookie'),
        body: fetchRequest.method === 'POST' ? await fetchRequest.text() : null,
      });
    } catch (error) {
      res.status(error instanceof PayloadTooLargeError ? 413 : 500).end();
    }
  });
}

describe('toFetchRequest', () => {
  it('copies the absolute URL, method and headers', async () => {
    const response = await request(createEchoApp())
      .get('/film/603?category=action')
      .set('Host', 'films.test:8080')
      .set('Cookie', 'wishlist=603');

    expect(response.body).toStrictEqual({
      url: 'http://films.test:8080/film/603?category=action',
      method: 'GET',
      cookie: 'wishlist=603',
      body: null,
    });
  });

  it('passes the body of a POST', async () => {
    const response = await request(createEchoApp()).post('/film/603').send('intent=add');

    expect(response.body).toMatchObject({ method: 'POST', body: 'intent=add' });
  });

  it('rejects bodies over the limit', async () => {
    const response = await request(createEchoApp()).post('/film/603').send('x'.repeat(17));

    expect(response.status).toBe(413);
  });
});

describe('sendFetchResponse', () => {
  it('sends status, headers, every Set-Cookie and the body', async () => {
    const app = express().use(async (_req, res) => {
      const headers = new Headers({ Location: '/film/603', 'X-Test': 'yes' });
      headers.append('Set-Cookie', 'a=1; Path=/');
      headers.append('Set-Cookie', 'b=2; Path=/');
      await sendFetchResponse(res, new Response('moved', { status: 303, headers }));
    });

    const response = await request(app).get('/');

    expect(response.status).toBe(303);
    expect(response.headers.location).toBe('/film/603');
    expect(response.headers['x-test']).toBe('yes');
    expect(response.headers['set-cookie']).toStrictEqual(['a=1; Path=/', 'b=2; Path=/']);
    expect(response.text).toBe('moved');
  });

  it('sends an empty body when the response has none', async () => {
    const app = express().use(async (_req, res) => {
      await sendFetchResponse(res, new Response(null, { status: 204 }));
    });

    const response = await request(app).get('/');

    expect(response.status).toBe(204);
    expect(response.text).toBe('');
  });
});
