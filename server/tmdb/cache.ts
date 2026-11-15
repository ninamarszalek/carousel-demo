export interface CacheOptions {
  /** The most entries kept; the oldest are dropped first. */
  maxEntries?: number;
  /** Injected in tests. */
  now?: () => number;
}

export interface Cache {
  /**
   * Returns the cached value for `key`, or calls `load` and caches its result for `ttlMs`
   * (a number, or a function of the loaded value). Concurrent calls for the same key share one
   * `load`. Rejections are not cached.
   */
  getOrLoad<T>(key: string, ttlMs: Ttl<T>, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export type Ttl<T> = number | ((value: T) => number);

interface Entry {
  value: Promise<unknown>;
  /** `Infinity` while the load is in flight. */
  expiresAt: number;
}

const DEFAULT_MAX_ENTRIES = 500;

/** In-memory TTL cache with in-flight de-duplication. One per server process. */
export function createCache({
  maxEntries = DEFAULT_MAX_ENTRIES,
  now = Date.now,
}: CacheOptions = {}): Cache {
  const entries = new Map<string, Entry>();

  function evictOverflow(): void {
    // A Map iterates in insertion order, so the first keys are the oldest.
    for (const key of entries.keys()) {
      if (entries.size <= maxEntries) {
        break;
      }
      entries.delete(key);
    }
  }

  return {
    getOrLoad<T>(key: string, ttlMs: Ttl<T>, load: () => Promise<T>): Promise<T> {
      const cached = entries.get(key);
      if (cached && cached.expiresAt > now()) {
        return cached.value as Promise<T>;
      }

      const entry: Entry = { value: Promise.resolve(), expiresAt: Infinity };
      const value = load().then(
        (result) => {
          entry.expiresAt = now() + (typeof ttlMs === 'function' ? ttlMs(result) : ttlMs);
          return result;
        },
        (error: unknown) => {
          // Only drop our own entry: a newer load may have replaced it in the meantime.
          if (entries.get(key) === entry) {
            entries.delete(key);
          }
          throw error;
        },
      );
      entry.value = value;

      entries.delete(key);
      entries.set(key, entry);
      evictOverflow();

      return value;
    },
    clear() {
      entries.clear();
    },
  };
}
