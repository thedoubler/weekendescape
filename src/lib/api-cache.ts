// A tiny in-memory TTL cache with in-flight request coalescing, used to shield
// the upstream (Tequila) API from repeat and concurrent identical calls. Scope
// is a single server instance — it resets on cold start and is not shared across
// serverless instances; for cross-instance correctness swap in a shared store
// (e.g. Upstash Redis). Good enough to cut quota burn from bursts and refetches.

interface Entry<T> {
  value: T;
  expires: number;
  fetchedAt: number;
}

const store = new Map<string, Entry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

// Keys are user-driven (origin × destination × dates × party size), so the set of
// distinct keys is effectively unbounded. Without eviction `store` only ever grows
// — a slow leak on a long-lived server. We bound it two ways: drop expired entries
// on write, and if that isn't enough, evict oldest-first down to MAX_ENTRIES.
// Map preserves insertion order, so the first keys are the least recently written.
export const MAX_ENTRIES = 500;

function evict(now: number): void {
  for (const [key, entry] of store) {
    if (entry.expires <= now) store.delete(key);
  }
  if (store.size <= MAX_ENTRIES) return;
  // Still over budget with everything live — shed the oldest writes.
  const excess = store.size - MAX_ENTRIES;
  let dropped = 0;
  for (const key of store.keys()) {
    if (dropped++ >= excess) break;
    store.delete(key);
  }
}

// Return a cached value if fresh; otherwise run `fn`, caching its result for
// `ttlMs`. Concurrent callers with the same key share one in-flight promise, so
// N simultaneous requests trigger a single upstream call. Failures are never
// cached (the rejection propagates and the slot is freed).
export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const now = Date.now();
  const hit = store.get(key);
  if (hit && hit.expires > now) return hit.value as T;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const value = await fn();
      const t = Date.now();
      // Delete-then-set so insertion order tracks write recency: re-setting an
      // existing key would otherwise keep its original position and make a hot,
      // freshly-refreshed key look like the oldest candidate for eviction.
      store.delete(key);
      store.set(key, { value, expires: t + ttlMs, fetchedAt: t });
      evict(t);
      return value;
    } finally {
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

// When the cached value for `key` was actually fetched upstream (epoch ms), or
// null if there's no live entry — so callers can show an honest "checked X ago"
// rather than pretending a 29-min-old cached price is live.
export function cacheFetchedAt(key: string): number | null {
  const hit = store.get(key);
  return hit && hit.expires > Date.now() ? hit.fetchedAt : null;
}

// Live entry count — exposed so tests can assert the cache stays bounded.
export function cacheSize(): number {
  return store.size;
}

// Test hook — drop all cached and in-flight entries so cases don't leak into
// one another.
export function clearApiCache(): void {
  store.clear();
  inflight.clear();
}
