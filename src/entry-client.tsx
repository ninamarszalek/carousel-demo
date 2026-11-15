import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';

import { createRoutes } from '@/app/routes';
import { createHttpFilmsApi } from '@/features/films/api/http-films-api';
import { createBrowserWishlistStorage } from '@/features/wishlist/wishlist-storage';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root element #root is missing in index.html.');
}

// The same routes as on the server, with browser data sources: `/api` instead of TMDB, and
// `document.cookie` for the wish list. The router picks up the server's loader data from
// `window.__staticRouterHydrationData`, so nothing is fetched again on hydration.
const router = createBrowserRouter(
  createRoutes({ films: createHttpFilmsApi(), wishlist: createBrowserWishlistStorage() }),
);

const app = (
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

// When SSR of the shell fails, the server sends an empty #root (see server/render.ts).
// In that case render on the client instead of hydrating, so the page still works.
if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
