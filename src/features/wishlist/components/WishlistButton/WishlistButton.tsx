import { useFetcher } from 'react-router';

import type { CategorySlug } from '@/features/films/categories';

import { WISHLIST_FIELDS, type WishlistIntent } from '../../wishlist-action';

import './_wishlist-button.scss';

interface WishlistButtonProps {
  filmId: number;
  filmTitle: string;
  category: CategorySlug | null;
  isOnList: boolean;
  /** `toggle` on the film page; `remove` on the wish list page. */
  variant?: 'toggle' | 'remove';
}

/**
 * Adds a film to, or removes it from, the wish list. It is a real form: it works before
 * hydration and without JavaScript (full page post), and with JavaScript it posts in the
 * background and shows the new state at once.
 */
export function WishlistButton({
  filmId,
  filmTitle,
  category,
  isOnList,
  variant = 'toggle',
}: WishlistButtonProps) {
  const fetcher = useFetcher();

  // Optimistic UI: while the post is in flight, show the state it will lead to.
  const pendingIntent = fetcher.formData?.get(WISHLIST_FIELDS.intent);
  const willBeOnList = pendingIntent ? pendingIntent === 'add' : isOnList;
  const intent: WishlistIntent = willBeOnList ? 'remove' : 'add';

  const label =
    variant === 'remove' ? 'Remove' : willBeOnList ? 'Remove from wish list' : 'Add to wish list';

  return (
    <fetcher.Form method="post" className="wishlist-button">
      <input type="hidden" name={WISHLIST_FIELDS.intent} value={intent} />
      <input type="hidden" name={WISHLIST_FIELDS.filmId} value={filmId} />
      {category && <input type="hidden" name={WISHLIST_FIELDS.category} value={category} />}
      <button
        type="submit"
        className={`wishlist-button__button wishlist-button__button--${variant}`}
        aria-pressed={variant === 'toggle' ? willBeOnList : undefined}
        aria-label={variant === 'remove' ? `Remove ${filmTitle} from wish list` : undefined}
      >
        {label}
      </button>
    </fetcher.Form>
  );
}
