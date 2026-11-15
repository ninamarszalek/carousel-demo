import { data, isRouteErrorResponse } from 'react-router';

import { FilmServiceError } from '@/types/films-api';

/**
 * Stops a loader or action with an HTTP error. React Router renders the nearest error element and,
 * on the server, uses `status` as the response status code.
 */
export function httpError(status: number, message: string): never {
  // React Router's error responses are plain objects, not Error instances, by design.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw data(message, { status });
}

/** The 502 page: the film service (TMDB, or our `/api`) could not answer. */
export function badGateway(): never {
  httpError(502, "Couldn't load films. Please try again in a moment.");
}

/** Runs `load`; a film service failure becomes a 502 page, anything else is rethrown as a bug. */
export async function orBadGateway<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (error instanceof FilmServiceError) {
      badGateway();
    }
    throw error;
  }
}

/** The status code of an error caught by an error element (thrown responses, or 500 for bugs). */
export function errorStatus(error: unknown): number {
  return isRouteErrorResponse(error) ? error.status : 500;
}
