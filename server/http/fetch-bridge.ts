import type { Request as ExpressRequest, Response as ExpressResponse } from 'express';

/** The request body was larger than allowed. Maps to 413. */
export class PayloadTooLargeError extends Error {
  override readonly name = 'PayloadTooLargeError';
}

export interface ToFetchRequestOptions {
  /** The most body bytes read for a POST. The only forms we accept are tiny. */
  maxBodyBytes?: number;
}

const DEFAULT_MAX_BODY_BYTES = 2048;

/**
 * Converts an Express request to a Fetch `Request`, the input React Router's static handler
 * expects. The signal aborts when the client goes away, so loaders can stop early.
 */
export async function toFetchRequest(
  req: ExpressRequest,
  res: ExpressResponse,
  { maxBodyBytes = DEFAULT_MAX_BODY_BYTES }: ToFetchRequestOptions = {},
): Promise<Request> {
  // `req.host` includes the port in Express 5.
  const url = new URL(req.originalUrl, `${req.protocol}://${req.host}`);

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    for (const item of Array.isArray(value) ? value : [value]) {
      if (item !== undefined) {
        headers.append(name, item);
      }
    }
  }

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) {
      controller.abort();
    }
  });

  const init: RequestInit = { method: req.method, headers, signal: controller.signal };
  if (req.method === 'POST') {
    init.body = await readBody(req, maxBodyBytes);
  }

  return new Request(url, init);
}

async function readBody(req: ExpressRequest, maxBytes: number): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > maxBytes) {
      throw new PayloadTooLargeError(`Request body is larger than ${String(maxBytes)} bytes.`);
    }
    chunks.push(chunk);
  }

  return Buffer.concat(chunks).toString('utf8');
}

/** Sends a Fetch `Response` (e.g. a redirect from a route action) through Express. */
export async function sendFetchResponse(res: ExpressResponse, response: Response): Promise<void> {
  res.status(response.status);

  for (const [name, value] of response.headers) {
    // `Headers` joins multiple Set-Cookie values with a comma, which breaks them; see below.
    if (name !== 'set-cookie') {
      res.setHeader(name, value);
    }
  }
  const cookies = response.headers.getSetCookie();
  if (cookies.length > 0) {
    res.setHeader('Set-Cookie', cookies);
  }

  res.end(response.body ? Buffer.from(await response.arrayBuffer()) : undefined);
}
