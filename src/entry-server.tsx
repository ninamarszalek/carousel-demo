import { StrictMode } from 'react';
import { renderToPipeableStream } from 'react-dom/server';
import {
  createStaticHandler,
  createStaticRouter,
  StaticRouterProvider,
  type StaticHandler,
} from 'react-router';

import { buildHead, serializeHead } from '@/app/head';
import { createRoutes } from '@/app/routes';
import { createServerWishlistStorage } from '@/features/wishlist/wishlist-storage';
import type { FilmsApi } from '@/types/films-api';
import type { SsrEntry } from '@/types/ssr';

/** One static handler per `FilmsApi` (in practice: one per server process). */
const handlers = new WeakMap<FilmsApi, StaticHandler>();

function getHandler(films: FilmsApi): StaticHandler {
  let handler = handlers.get(films);
  if (!handler) {
    handler = createStaticHandler(
      createRoutes({ films, wishlist: createServerWishlistStorage(), deferData: false }),
    );
    handlers.set(films, handler);
  }
  return handler;
}

/**
 * Server entry, implements `SsrEntry` (src/types/ssr.ts).
 *
 * The router matches the URL and runs the loaders (or the action, for a form post) first. Only
 * then is the page rendered, so the status code (200/404/502) and the head tags are known before
 * the first byte is sent. The loaded data is serialized into the HTML by `StaticRouterProvider`
 * (escaped, with the CSP nonce), and the browser router hydrates from it without fetching again.
 */
export const handle: SsrEntry['handle'] = async (request, { films, nonce }) => {
  const handler = getHandler(films);
  const context = await handler.query(request);

  // Redirects (e.g. after a wish list form post) and other plain responses.
  if (context instanceof Response) {
    return { kind: 'response', response: context };
  }

  const errorStatus = context.errors ? context.statusCode : null;
  const head = buildHead(
    context.matches.map((match) => ({
      handle: match.route.handle as unknown,
      loaderData: context.loaderData[match.route.id] as unknown,
    })),
    errorStatus,
  );
  const router = createStaticRouter(handler.dataRoutes, context);

  return {
    kind: 'render',
    statusCode: context.statusCode,
    head: serializeHead(head),
    render: (options) =>
      renderToPipeableStream(
        <StrictMode>
          <StaticRouterProvider router={router} context={context} nonce={nonce} />
        </StrictMode>,
        options,
      ),
  };
};
