import path from 'node:path';

import { compile } from 'sass-embedded';
import { describe, expect, it } from 'vitest';

import {
  filmPath,
  getCategory,
  GRADIENT_STEPS,
  gradientStep,
  isCategorySlug,
  resolveCategory,
} from './categories';

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

describe('gradientStep', () => {
  it('cycles through the steps as the carousel moves on', () => {
    expect([0, 1, 2, 3, 4, 5].map(gradientStep)).toStrictEqual([0, 1, 2, 3, 0, 1]);
  });

  it('has as many steps as the theme stylesheet defines', () => {
    // Relative to the project root: jsdom gives `import.meta.url` an http scheme.
    const stylesheet = path.join(process.cwd(), 'src/styles/themes/_categories.scss');
    const { css } = compile(stylesheet);
    const steps = new Set(
      [...css.matchAll(/\[data-gradient-step="(\d+)"\]/g)].map(([, step]) => Number(step)),
    );

    // Step 0 is every theme's base look; the stylesheet has one rule per further step.
    const expected = Array.from({ length: GRADIENT_STEPS - 1 }, (_, index) => index + 1);
    expect([...steps].toSorted((a, b) => a - b)).toStrictEqual(expected);
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
