import { describe, expect, it, vi } from 'vitest';

import { createCache } from './cache';

function createClock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('createCache', () => {
  it('returns the cached value until the TTL expires', async () => {
    const clock = createClock();
    const cache = createCache({ now: clock.now });
    const load = vi.fn().mockResolvedValueOnce('first').mockResolvedValueOnce('second');

    expect(await cache.getOrLoad('key', 1000, load)).toBe('first');
    clock.advance(999);
    expect(await cache.getOrLoad('key', 1000, load)).toBe('first');
    clock.advance(1);
    expect(await cache.getOrLoad('key', 1000, load)).toBe('second');
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('shares one load between concurrent calls for the same key', async () => {
    const cache = createCache();
    const load = vi.fn(() => Promise.resolve('value'));

    const results = await Promise.all([
      cache.getOrLoad('key', 1000, load),
      cache.getOrLoad('key', 1000, load),
      cache.getOrLoad('key', 1000, load),
    ]);

    expect(results).toStrictEqual(['value', 'value', 'value']);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not cache failures', async () => {
    const cache = createCache();
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('TMDB down'))
      .mockResolvedValueOnce('value');

    await expect(cache.getOrLoad('key', 1000, load)).rejects.toThrow('TMDB down');
    await expect(cache.getOrLoad('key', 1000, load)).resolves.toBe('value');
  });

  it('can choose the TTL from the loaded value', async () => {
    const clock = createClock();
    const cache = createCache({ now: clock.now });
    const ttl = (value: string | null) => (value === null ? 100 : 1000);
    const load = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);

    await cache.getOrLoad('missing', ttl, load);
    clock.advance(100);
    await cache.getOrLoad('missing', ttl, load);

    expect(load).toHaveBeenCalledTimes(2);
  });

  it('drops the oldest entries when it is full', async () => {
    const cache = createCache({ maxEntries: 2 });
    const load = vi.fn((value: string) => Promise.resolve(value));

    await cache.getOrLoad('a', 1000, () => load('a'));
    await cache.getOrLoad('b', 1000, () => load('b'));
    await cache.getOrLoad('c', 1000, () => load('c'));
    await cache.getOrLoad('b', 1000, () => load('b'));
    await cache.getOrLoad('a', 1000, () => load('a'));

    expect(load.mock.calls.map(([value]) => value)).toStrictEqual(['a', 'b', 'c', 'a']);
  });

  it('can be cleared', async () => {
    const cache = createCache();
    const load = vi.fn(() => Promise.resolve('value'));

    await cache.getOrLoad('key', 1000, load);
    cache.clear();
    await cache.getOrLoad('key', 1000, load);

    expect(load).toHaveBeenCalledTimes(2);
  });
});
