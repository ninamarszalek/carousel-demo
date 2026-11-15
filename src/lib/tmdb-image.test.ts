import { describe, expect, it } from 'vitest';

import { tmdbImage, tmdbImageUrl } from './tmdb-image';

describe('tmdbImage', () => {
  it('builds a srcset of every poster width and a mid-size fallback', () => {
    expect(tmdbImage('/abc.jpg', 'poster')).toStrictEqual({
      src: 'https://image.tmdb.org/t/p/w342/abc.jpg',
      srcSet: [185, 342, 500, 780]
        .map((width) => `https://image.tmdb.org/t/p/w${String(width)}/abc.jpg ${String(width)}w`)
        .join(', '),
    });
  });

  it('uses the largest size for link previews', () => {
    expect(tmdbImageUrl('/abc.jpg', 'backdrop')).toBe('https://image.tmdb.org/t/p/w1280/abc.jpg');
  });
});
