import { randomBytes } from 'node:crypto';

import type { RequestHandler, Response } from 'express';
import type { HelmetOptions } from 'helmet';

interface CspLocals {
  cspNonce?: string;
}

/**
 * Creates a fresh nonce for every request. The pages need two kinds of inline scripts: the router's
 * hydration data and React's streaming helpers. Both carry this nonce, so the CSP can allow them
 * without `'unsafe-inline'`.
 */
export const cspNonce: RequestHandler = (_req, res, next) => {
  (res.locals as CspLocals).cspNonce = randomBytes(16).toString('base64');
  next();
};

export function getCspNonce(res: Response): string {
  const nonce = (res.locals as CspLocals).cspNonce;
  if (nonce === undefined) {
    throw new Error('CSP nonce is missing: the cspNonce middleware must run first.');
  }
  return nonce;
}

/** Content Security Policy for production. Dev is excluded because Vite injects inline scripts for HMR. */
export const CONTENT_SECURITY_POLICY: Exclude<
  HelmetOptions['contentSecurityPolicy'],
  boolean | undefined
> = {
  directives: {
    'script-src': ["'self'", (_req, res) => `'nonce-${getCspNonce(res as Response)}'`],
    'img-src': ["'self'", 'data:', 'https://image.tmdb.org'],
    // HTTPS is the job of the reverse proxy; upgrading requests would break plain-HTTP runs on a LAN IP.
    'upgrade-insecure-requests': null,
  },
};
