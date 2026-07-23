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
      store.set(key, { value, expires: t + ttlMs, fetchedAt: t });
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

// Test hook — drop all cached and in-flight entries so cases don't leak into
// one another.
export function clearApiCache(): void {
  store.clear();
  inflight.clear();
}
