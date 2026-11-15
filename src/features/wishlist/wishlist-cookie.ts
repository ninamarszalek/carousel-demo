import { isCategorySlug, type CategorySlug } from '@/features/films/categories';
import { MAX_FILMS_PER_REQUEST, parseId } from '@/types/films-api';

export interface WishlistItem {
  filmId: number;
  /** The category the film was added from; it decides the look of the film page link. */
  category: CategorySlug | null;
}

export const WISHLIST_COOKIE = 'wishlist';
// The wish list page loads all its films in one `getFilms()` call, so the list can never hold more.
export const MAX_WISHLIST_ITEMS = MAX_FILMS_PER_REQUEST;
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/**
 * Cookie value format: `603:action,550:comedy,27205`, URI-encoded, newest item first.
 * Parsing never throws: the cookie can be edited by hand, so invalid entries and duplicates are
 * dropped and the list is capped.
 */
export function parseWishlist(value: string | null | undefined): WishlistItem[] {
  if (!value) {
    return [];
  }

  let decoded: string;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return [];
  }

  const items: WishlistItem[] = [];
  for (const entry of decoded.split(',')) {
    const [idPart, categoryPart] = entry.split(':');
    const filmId = parseId(idPart);
    if (filmId === null || items.some((item) => item.filmId === filmId)) {
      continue;
    }
    items.push({ filmId, category: isCategorySlug(categoryPart) ? categoryPart : null });
    if (items.length === MAX_WISHLIST_ITEMS) {
      break;
    }
  }
  return items;
}

export function serializeWishlist(items: readonly WishlistItem[]): string {
  return encodeURIComponent(
    items
      .map(({ filmId, category }) => (category ? `${String(filmId)}:${category}` : String(filmId)))
      .join(','),
  );
}

/** The full `Set-Cookie` / `document.cookie` string for a list. */
export function wishlistCookie(items: readonly WishlistItem[]): string {
  // Not HttpOnly: the browser writes it after hydration. Not Secure: the app must also work over
  // plain HTTP locally (a proxy in front can add the flag).
  return `${WISHLIST_COOKIE}=${serializeWishlist(items)}; Path=/; Max-Age=${String(ONE_YEAR_IN_SECONDS)}; SameSite=Lax`;
}

/** Reads the wish list from a `Cookie` header or `document.cookie` (same format). */
export function readWishlistCookie(cookieHeader: string | null): WishlistItem[] {
  for (const pair of cookieHeader?.split(';') ?? []) {
    const [name, ...value] = pair.trim().split('=');
    if (name === WISHLIST_COOKIE) {
      return parseWishlist(value.join('='));
    }
  }
  return [];
}

/** Adds an item to the top of the list (moves it there if it is already on the list). */
export function addItem(items: readonly WishlistItem[], item: WishlistItem): WishlistItem[] {
  return [item, ...removeItem(items, item.filmId)].slice(0, MAX_WISHLIST_ITEMS);
}

export function removeItem(items: readonly WishlistItem[], filmId: number): WishlistItem[] {
  return items.filter((item) => item.filmId !== filmId);
}

export function hasItem(items: readonly WishlistItem[], filmId: number): boolean {
  return items.some((item) => item.filmId === filmId);
}
