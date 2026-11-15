import { redirect } from 'react-router';

import { readWishlistCookie, wishlistCookie, type WishlistItem } from './wishlist-cookie';

/**
 * Where the wish list lives: a cookie, so the server can render it. Loaders and actions use this
 * interface and do not know which side they run on.
 */
export interface WishlistStorage {
  read(request: Request): WishlistItem[];
  /**
   * Persists the list and returns the action result:
   * - server (a form post without JavaScript): a 303 redirect back to the page, with `Set-Cookie`,
   * - browser: writes `document.cookie` and returns `null`; the router then revalidates.
   */
  save(items: readonly WishlistItem[], request: Request): Response | null;
}

export function createServerWishlistStorage(): WishlistStorage {
  return {
    read: (request) => readWishlistCookie(request.headers.get('Cookie')),
    // Post/Redirect/Get: reloading the page after adding does not post the form again. The target
    // is a path, so it stays correct behind a proxy that terminates HTTPS.
    save: (items, request) => {
      const { pathname, search } = new URL(request.url);
      return redirect(`${pathname}${search}`, {
        status: 303,
        headers: { 'Set-Cookie': wishlistCookie(items) },
      });
    },
  };
}

/** Browsers do not expose cookies on the router's `Request`, so this reads `document.cookie`. */
export function createBrowserWishlistStorage(doc: Document = document): WishlistStorage {
  return {
    read: () => readWishlistCookie(doc.cookie),
    save: (items) => {
      doc.cookie = wishlistCookie(items);
      return null;
    },
  };
}
