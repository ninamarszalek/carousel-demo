import { describe, expect, it } from 'vitest';

import { formatDate, formatLanguage, formatRating, formatRuntime, pluralize } from './format';

describe('format', () => {
  it.each([
    [45, '45m'],
    [60, '1h'],
    [136, '2h 16m'],
  ])('formats a runtime of %i minutes as %s', (minutes, expected) => {
    expect(formatRuntime(minutes)).toBe(expected);
  });

  it('formats dates the same way everywhere (UTC, en-US)', () => {
    expect(formatDate('1999-03-31')).toBe('March 31, 1999');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('names languages', () => {
    expect(formatLanguage('en')).toBe('English');
    expect(formatLanguage('ko')).toBe('Korean');
    expect(formatLanguage('!!')).toBe('!!');
  });

  it('formats ratings and counts', () => {
    expect(formatRating(8.24)).toBe('8.2');
    expect(formatRating(7)).toBe('7.0');
    expect(pluralize(1, 'film')).toBe('1 film');
    expect(pluralize(0, 'film')).toBe('0 films');
  });
});
