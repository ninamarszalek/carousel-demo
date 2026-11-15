import type { ActionFunctionArgs } from 'react-router';
import { describe, expect, it } from 'vitest';

import { createMemoryWishlistStorage } from '../../../tests/mocks/memory-wishlist-storage';
import { createWishlistAction } from './wishlist-action';
import { createBrowserWishlistStorage, createServerWishlistStorage } from './wishlist-storage';

function postForm(fields: Record<string, string>, cookie?: string): Request {
  return new Request('http://localhost/film/603?category=action', {
    method: 'POST',
    body: new URLSearchParams(fields),
    headers: cookie ? { Cookie: cookie } : {},
  });
}

function runAction(action: ReturnType<typeof createWishlistAction>, request: Request) {
  return action({ request, params: {} } as unknown as ActionFunctionArgs);
}

describe('createWishlistAction', () => {
  it('adds a film with its category', async () => {
    const storage = createMemoryWishlistStorage([{ filmId: 419430, category: 'horror' }]);

    await runAction(
      createWishlistAction(storage),
      postForm({ intent: 'add', filmId: '603', category: 'action' }),
    );

    expect(storage.items).toStrictEqual([
      { filmId: 603, category: 'action' },
      { filmId: 419430, category: 'horror' },
    ]);
  });

  it('removes a film', async () => {
    const storage = createMemoryWishlistStorage([{ filmId: 603, category: 'action' }]);

    await runAction(createWishlistAction(storage), postForm({ intent: 'remove', filmId: '603' }));

    expect(storage.items).toStrictEqual([]);
  });

  it('ignores an unknown category', async () => {
    const storage = createMemoryWishlistStorage();

    await runAction(
      createWishlistAction(storage),
      postForm({ intent: 'add', filmId: '603', category: '<script>' }),
    );

    expect(storage.items).toStrictEqual([{ filmId: 603, category: null }]);
  });

  it.each([
    ['an unknown intent', { intent: 'clear', filmId: '603' }],
    ['a missing film id', { intent: 'add' }],
    ['an invalid film id', { intent: 'add', filmId: '1e3' }],
  ])('rejects %s with 400', async (_name, fields) => {
    const storage = createMemoryWishlistStorage();

    await expect(runAction(createWishlistAction(storage), postForm(fields))).rejects.toMatchObject({
      init: { status: 400 },
    });
    expect(storage.items).toStrictEqual([]);
  });
});

describe('createServerWishlistStorage', () => {
  it('reads the Cookie header and saves with a 303 redirect back to the page', async () => {
    const storage = createServerWishlistStorage();
    const request = postForm({}, 'wishlist=603%3Aaction');

    expect(storage.read(request)).toStrictEqual([{ filmId: 603, category: 'action' }]);

    const response = storage.save([], request);
    expect(response?.status).toBe(303);
    expect(response?.headers.get('Location')).toBe('/film/603?category=action');
    expect(response?.headers.get('Set-Cookie')).toMatch(/^wishlist=; Path=\//);
    await expect(response?.text()).resolves.toBe('');
  });
});

describe('createBrowserWishlistStorage', () => {
  it('reads and writes document.cookie', () => {
    const storage = createBrowserWishlistStorage();

    expect(storage.save([{ filmId: 603, category: 'action' }], postForm({}))).toBeNull();
    expect(document.cookie).toContain('wishlist=603%3Aaction');
    expect(storage.read(postForm({}))).toStrictEqual([{ filmId: 603, category: 'action' }]);

    storage.save([], postForm({}));
    expect(storage.read(postForm({}))).toStrictEqual([]);
  });
});
