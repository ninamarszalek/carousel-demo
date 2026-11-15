import type { RouteObject } from 'react-router';

import { createWishlistRootLoader, WISHLIST_ROUTE_ID } from '@/features/wishlist/use-wishlist';
import { createWishlistAction } from '@/features/wishlist/wishlist-action';
import type { WishlistStorage } from '@/features/wishlist/wishlist-storage';
import { httpError } from '@/lib/http-error';
import {
  createFilmLoader,
  FilmDetailsPage,
  filmHandle,
  shouldRevalidateFilm,
} from '@/pages/FilmDetailsPage';
import { createHomeLoader, HomePage } from '@/pages/HomePage';
import { createWishlistLoader, WishlistPage } from '@/pages/WishlistPage';
import type { FilmsApi } from '@/types/films-api';

import { defineHead } from './head';
import { PageOutlet, RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

/** What the routes need from the outside; each entry (server, browser, tests) passes its own. */
export interface RouteDeps {
  films: FilmsApi;
  wishlist: WishlistStorage;
  /**
   * `false` on the server (loaders wait, so the HTML is complete), `true` in the browser (pages
   * appear at once and show skeletons while their data loads). See `createHomeLoader`.
   */
  deferData: boolean;
}

/**
 * The single route tree for the server (static handler) and the browser (data router).
 * Loaders and actions get their data sources from `deps`, so they never check where they run.
 */
export function createRoutes({ films, wishlist, deferData }: RouteDeps): RouteObject[] {
  const wishlistAction = createWishlistAction(wishlist);

  return [
    {
      id: WISHLIST_ROUTE_ID,
      path: '/',
      element: <RootLayout />,
      loader: createWishlistRootLoader(wishlist),
      // Only reached if the layout itself fails; page errors are caught below, inside the layout.
      errorElement: <RouteError />,
      // Rendered only when the server could not render the page and the browser starts from
      // scratch (see entry-client.tsx); the loaders then run in the browser.
      hydrateFallbackElement: null,
      children: [
        {
          element: <PageOutlet />,
          errorElement: <RouteError />,
          children: [
            { index: true, element: <HomePage />, loader: createHomeLoader(films, { deferData }) },
            {
              path: 'film/:id',
              element: <FilmDetailsPage />,
              loader: createFilmLoader(films),
              action: wishlistAction,
              shouldRevalidate: shouldRevalidateFilm,
              handle: filmHandle,
            },
            {
              path: 'wishlist',
              element: <WishlistPage />,
              loader: createWishlistLoader(films, wishlist),
              action: wishlistAction,
              handle: defineHead(() => ({ title: 'Wish list' })),
            },
            {
              path: '*',
              loader: () => httpError(404, 'Page not found'),
            },
          ],
        },
      ],
    },
  ];
}
