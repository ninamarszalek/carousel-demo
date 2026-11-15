import type { RequestHandler } from 'msw';

/** Default network mocks shared by all client tests. Tests can override them with `server.use()`. */
export const handlers: RequestHandler[] = [];
