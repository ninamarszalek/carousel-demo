import { useRouteLoaderData, type LoaderFunction } from 'react-router';

import type { WishlistItem } from './wishlist-cookie';
import type { WishlistStorage } from './wishlist-storage';

/** The route that loads the wish list: the root, so every page (and the header) can read it. */
export const WISHLIST_ROUTE_ID = 'root';

export interface WishlistLoaderData {
  wishlist: WishlistItem[];
}

export function createWishlistRootLoader(storage: WishlistStorage): LoaderFunction {
  return ({ request }): WishlistLoaderData => ({ wishlist: storage.read(request) });
}

/** The wish list items (ids and categories). Revalidated after every wish list action. */
export function useWishlist(): WishlistItem[] {
  return useRouteLoaderData<WishlistLoaderData>(WISHLIST_ROUTE_ID)?.wishlist ?? [];
}
