import { describe, expect, it } from 'vitest';

import { filmFacts } from './film-facts';

describe('filmFacts', () => {
  it('lists the known facts in order', () => {
    expect(filmFacts({ releaseYear: 1999, rating: 8.2, runtimeMinutes: 136 })).toEqual([
      '1999',
      '2h 16m',
      '★ 8.2',
    ]);
  });

  it('skips the unknown ones', () => {
    expect(filmFacts({ releaseYear: null, rating: null })).toEqual([]);
    expect(filmFacts({ releaseYear: 2001, rating: null })).toEqual(['2001']);
  });
});
