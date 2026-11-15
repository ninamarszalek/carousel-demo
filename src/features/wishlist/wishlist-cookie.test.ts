import { describe, expect, it } from 'vitest';

import {
  addItem,
  hasItem,
  MAX_WISHLIST_ITEMS,
  parseWishlist,
  readWishlistCookie,
  removeItem,
  serializeWishlist,
  wishlistCookie,
  type WishlistItem,
} from './wishlist-cookie';

const MATRIX: WishlistItem = { filmId: 603, category: 'action' };
const GET_OUT: WishlistItem = { filmId: 419430, category: 'horror' };
const NO_CATEGORY: WishlistItem = { filmId: 27205, category: null };

describe('wish list cookie format', () => {
  it('round-trips a list', () => {
    const items = [MATRIX, GET_OUT, NO_CATEGORY];

    expect(serializeWishlist(items)).toBe('603%3Aaction%2C419430%3Ahorror%2C27205');
    expect(parseWishlist(serializeWishlist(items))).toStrictEqual(items);
  });

  it.each([undefined, null, '', '%E0%A4%A', 'garbage', ',,,'])(
    'parses %j to an empty list without throwing',
    (value) => {
      expect(parseWishlist(value)).toStrictEqual([]);
    },
  );

  it('drops invalid entries and duplicates, and ignores unknown categories', () => {
    expect(
      parseWishlist(encodeURIComponent('603:action,abc,603:comedy,-5,419430:drama')),
    ).toStrictEqual([MATRIX, { filmId: 419430, category: null }]);
  });

  it(`keeps at most ${String(MAX_WISHLIST_ITEMS)} items`, () => {
    const ids = Array.from({ length: MAX_WISHLIST_ITEMS + 10 }, (_, index) => String(index + 1));

    expect(parseWishlist(ids.join(','))).toHaveLength(MAX_WISHLIST_ITEMS);
  });

  it('builds the cookie string with its attributes', () => {
    expect(wishlistCookie([MATRIX])).toBe(
      'wishlist=603%3Aaction; Path=/; Max-Age=31536000; SameSite=Lax',
    );
  });

  it('reads the list from a Cookie header with other cookies', () => {
    expect(readWishlistCookie('theme=dark; wishlist=603%3Aaction; other=1')).toStrictEqual([
      MATRIX,
    ]);
    expect(readWishlistCookie('theme=dark')).toStrictEqual([]);
    expect(readWishlistCookie(null)).toStrictEqual([]);
  });
});

describe('wish list operations', () => {
  it('adds new items to the top', () => {
    expect(addItem([MATRIX], GET_OUT)).toStrictEqual([GET_OUT, MATRIX]);
  });

  it('moves an item that is already on the list to the top, with its new category', () => {
    expect(addItem([GET_OUT, MATRIX], { filmId: 603, category: 'comedy' })).toStrictEqual([
      { filmId: 603, category: 'comedy' },
      GET_OUT,
    ]);
  });

  it('drops the oldest item when the list is full', () => {
    const full = Array.from({ length: MAX_WISHLIST_ITEMS }, (_, index) => ({
      filmId: index + 1,
      category: null,
    }));

    const result = addItem(full, MATRIX);

    expect(result).toHaveLength(MAX_WISHLIST_ITEMS);
    expect(result[0]).toBe(MATRIX);
    expect(hasItem(result, MAX_WISHLIST_ITEMS)).toBe(false);
  });

  it('removes items and checks membership', () => {
    const items = removeItem([MATRIX, GET_OUT], 603);

    expect(items).toStrictEqual([GET_OUT]);
    expect(hasItem(items, 603)).toBe(false);
    expect(hasItem(items, 419430)).toBe(true);
  });
});
