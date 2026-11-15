import type { ActionFunction } from 'react-router';

import { isCategorySlug } from '@/features/films/categories';
import { httpError } from '@/lib/http-error';
import { parseId } from '@/types/films-api';

import { addItem, removeItem } from './wishlist-cookie';
import type { WishlistStorage } from './wishlist-storage';

export const WISHLIST_INTENTS = ['add', 'remove'] as const;
export type WishlistIntent = (typeof WISHLIST_INTENTS)[number];

/** Form field names, shared by the action and the forms that post to it. */
export const WISHLIST_FIELDS = {
  intent: 'intent',
  filmId: 'filmId',
  category: 'category',
} as const;

function isIntent(value: unknown): value is WishlistIntent {
  return WISHLIST_INTENTS.some((intent) => intent === value);
}

/**
 * Adds a film to, or removes it from, the wish list. Attached to every route that shows a wish
 * list button, so a form post without JavaScript returns to the same page.
 */
export function createWishlistAction(storage: WishlistStorage): ActionFunction {
  return async ({ request }) => {
    const form = await request.formData();
    const intent = form.get(WISHLIST_FIELDS.intent);
    const filmIdValue = form.get(WISHLIST_FIELDS.filmId);
    const filmId = parseId(typeof filmIdValue === 'string' ? filmIdValue : null);
    if (!isIntent(intent) || filmId === null) {
      httpError(400, 'Invalid wish list request');
    }

    const categoryValue = form.get(WISHLIST_FIELDS.category);
    const category = isCategorySlug(categoryValue) ? categoryValue : null;
    const items = storage.read(request);

    return storage.save(
      intent === 'add' ? addItem(items, { filmId, category }) : removeItem(items, filmId),
      request,
    );
  };
}
