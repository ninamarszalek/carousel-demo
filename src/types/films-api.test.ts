import { describe, expect, it } from 'vitest';

import { parseId } from './films-api';

describe('parseId', () => {
  it.each([
    ['1', 1],
    ['603', 603],
    ['9999999999', 9_999_999_999],
  ])('parses %s', (value, expected) => {
    expect(parseId(value)).toBe(expected);
  });

  it.each([undefined, null, '', '0', '007', '-1', '+1', '1.5', '1e3', ' 1', 'abc', '12345678901'])(
    'rejects %j',
    (value) => {
      expect(parseId(value)).toBeNull();
    },
  );
});
