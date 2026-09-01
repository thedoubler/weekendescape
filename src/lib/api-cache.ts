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

// A SECOND tier, shared across isolates.
//
// The Map above is per-isolate and dies on cold start. On a long-lived Node
// server that is merely imperfect; on Cloudflare Workers, where isolates are
// many and short-lived, it means the hit rate in production is far below what
// local testing suggests — and every miss is a paid upstream call. KV is the
// shared layer: slower than memory, enormously cheaper than Kiwi.
//
// Absent binding = absent tier. In `next dev`, in vitest, on any non-Workers
// host, every one of these returns null or no-ops and the cache behaves exactly
// as it did before. That is deliberate: a cache must never be the reason the
// product breaks.
type Kv = {
  get: (k: string, t: "json") => Promise<unknown>;
  put: (k: string, v: string, o?: { expirationTtl?: number }) => Promise<void>;
};

// Resolved once per isolate, not once per cache miss: the dynamic import and
// the context lookup are the same answer every time, and paying for them on
// every upstream miss would be a cost the cache exists to avoid.
let kvOnce: Promise<Kv | null> | null = null;
function kv(): Promise<Kv | null> {
  return (kvOnce ??= resolveKv());
}

async function resolveKv(): Promise<Kv | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const ctx = await getCloudflareContext({ async: true });
    const b = (ctx?.env as Record<string, unknown> | undefined)?.API_CACHE;
    if (b && typeof (b as Kv).get === "function") return b as Kv;
  } catch {
    // Not on Workers, or no namespace bound.
  }
  return null;
}

// KV keys must be safe and bounded; our cache keys are long and contain
// characters KV tolerates but that are unpleasant to debug in the dashboard.
const kvKey = (k: string) => `v1:${k}`.slice(0, 512);

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
      // L2 before the upstream call. A hit is promoted into memory so the rest
      // of this isolate's life is served locally, and so cacheFetchedAt() —
      // which the "checked X ago" stamp reads — keeps working unchanged.
      const shared = await kv();
      if (shared) {
        try {
          const raw = (await shared.get(kvKey(key), "json")) as
            | { v: T; t: number; e: number }
            | null;
          if (raw && raw.e > Date.now()) {
            store.delete(key);
            store.set(key, { value: raw.v, expires: raw.e, fetchedAt: raw.t });
            evict(Date.now());
            return raw.v;
          }
        } catch {
          // A KV read that fails is a miss, never an error.
        }
      }
      const value = await fn();
      const t = Date.now();
      // Delete-then-set so insertion order tracks write recency: re-setting an
      // existing key would otherwise keep its original position and make a hot,
      // freshly-refreshed key look like the oldest candidate for eviction.
      store.delete(key);
      store.set(key, { value, expires: t + ttlMs, fetchedAt: t });
      evict(t);
      if (shared) {
        // Not awaited on the request path: the caller already has its answer,
        // and a slow KV write should not slow the response down. KV requires a
        // whole number of seconds, minimum 60.
        void shared
          .put(
            kvKey(key),
            JSON.stringify({ v: value, t, e: t + ttlMs }),
            { expirationTtl: Math.max(60, Math.round(ttlMs / 1000)) }
          )
          .catch(() => {});
      }
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
