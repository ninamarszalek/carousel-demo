import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

import { errorStatus } from '@/lib/http-error';

import { DocumentTitle } from '../DocumentTitle';

import './_route-error.scss';

/** Error page rendered inside the layout: 404s, 502s (TMDB down) and unexpected errors. */
export function RouteError() {
  const error = useRouteError();
  const status = errorStatus(error);
  const notFound = status === 404;

  return (
    <section className="route-error container" aria-labelledby="route-error-title">
      <DocumentTitle errorStatus={status} />
      <h1 className="route-error__title" id="route-error-title">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      <p className="route-error__message">{errorMessage(error, notFound)}</p>
      <p>
        <Link to="/">Back to all films</Link>
      </p>
    </section>
  );
}

function errorMessage(error: unknown, notFound: boolean): string {
  if (notFound) {
    return "We couldn't find what you were looking for.";
  }
  // Messages from thrown error responses are written for users; other errors are bugs, and their
  // details stay in the server log.
  if (isRouteErrorResponse(error) && typeof error.data === 'string') {
    return error.data;
  }
  return 'An unexpected error occurred. Please try again later.';
}
