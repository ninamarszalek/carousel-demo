import type { WishlistItem } from '@/features/wishlist/wishlist-cookie';
import type { WishlistStorage } from '@/features/wishlist/wishlist-storage';

/** A `WishlistStorage` that keeps the list in memory, like the browser storage does (no redirect). */
export function createMemoryWishlistStorage(
  initial: WishlistItem[] = [],
): WishlistStorage & { items: WishlistItem[] } {
  const storage = {
    items: [...initial],
    read: () => storage.items,
    save: (items: readonly WishlistItem[]) => {
      storage.items = [...items];
      return null;
    },
  };
  return storage;
}
