import { describe, expect, it } from 'vitest';

import { filmPath, getCategory, isCategorySlug, resolveCategory } from './categories';

describe('resolveCategory', () => {
  it('uses a valid category from the URL, even if the film has other genres', () => {
    expect(resolveCategory('comedy', [28, 35])).toBe('comedy');
    expect(resolveCategory('horror', [28])).toBe('horror');
  });

  it('falls back to the first category, in carousel order, that matches a genre', () => {
    expect(resolveCategory(null, [35, 28])).toBe('action');
    expect(resolveCategory('drama', [9648, 27])).toBe('horror');
  });

  it('is null when nothing matches (default look)', () => {
    expect(resolveCategory(null, [18])).toBeNull();
    expect(resolveCategory('', [])).toBeNull();
  });
});

describe('categories', () => {
  it('recognizes category slugs', () => {
    expect(isCategorySlug('action')).toBe(true);
    expect(isCategorySlug('Action')).toBe(false);
    expect(isCategorySlug(28)).toBe(false);
  });

  it('looks a category up by slug', () => {
    expect(getCategory('horror')).toStrictEqual({ slug: 'horror', label: 'Horror', genreId: 27 });
  });

  it('builds film page paths', () => {
    expect(filmPath(603)).toBe('/film/603');
    expect(filmPath(603, 'action')).toBe('/film/603?category=action');
  });
});
