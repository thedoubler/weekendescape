import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { cached, clearApiCache, cacheSize, MAX_ENTRIES } from "@/lib/api-cache";

describe("cached", () => {
  beforeEach(() => clearApiCache());

  it("returns a fresh value only once within the TTL", async () => {
    const fn = vi.fn(async () => "v1");
    const a = await cached("k", 1000, fn);
    const b = await cached("k", 1000, fn);
    expect(a).toBe("v1");
    expect(b).toBe("v1");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("coalesces concurrent calls into a single execution", async () => {
    let resolve!: (v: string) => void;
    const fn = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const p1 = cached("k", 1000, fn);
    const p2 = cached("k", 1000, fn);
    // `cached` consults the shared KV tier before calling `fn`, so the upstream
    // call starts a tick later than it used to. Coalescing is unaffected — the
    // in-flight promise is registered synchronously, which is what this test is
    // really about — but we have to wait for `fn` to hand us its resolver.
    await vi.waitFor(() => expect(fn).toHaveBeenCalled());
    resolve("shared");
    expect(await p1).toBe("shared");
    expect(await p2).toBe("shared");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not cache failures", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    await expect(cached("k", 1000, fn)).rejects.toThrow("boom");
    // A later call re-runs fn since the rejection was not cached.
    await expect(cached("k", 1000, fn)).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("keys entries independently", async () => {
    await cached("a", 1000, async () => "A");
    const b = await cached("b", 1000, async () => "B");
    expect(b).toBe("B");
  });
});

// The cache is a process-lifetime singleton on a long-lived server, and its keys
// are user-driven, so unbounded growth is a real leak rather than a tidiness nit.
describe("cached — bounded growth", () => {
  beforeEach(() => clearApiCache());
  afterEach(() => vi.useRealTimers());

  it("drops expired entries instead of retaining them forever", async () => {
    vi.useFakeTimers();
    for (let i = 0; i < 50; i++) {
      await cached(`expiring:${i}`, 1000, async () => i);
    }
    expect(cacheSize()).toBe(50);

    // Past every TTL — the next write should sweep all of the stale entries.
    vi.advanceTimersByTime(5000);
    await cached("fresh", 1000, async () => "fresh");
    expect(cacheSize()).toBe(1);
  });

  it("caps entries when every key is still live", async () => {
    const total = MAX_ENTRIES + 120;
    for (let i = 0; i < total; i++) {
      await cached(`live:${i}`, 60_000, async () => i);
    }
    expect(cacheSize()).toBeLessThanOrEqual(MAX_ENTRIES);
  });

  it("evicts oldest-first, keeping the most recent writes", async () => {
    for (let i = 0; i < MAX_ENTRIES + 10; i++) {
      await cached(`ordered:${i}`, 60_000, async () => i);
    }
    // The newest key survives; the oldest was shed to stay within budget.
    const newest = vi.fn(async () => "recomputed");
    await cached(`ordered:${MAX_ENTRIES + 9}`, 60_000, newest);
    expect(newest).not.toHaveBeenCalled();

    const oldest = vi.fn(async () => "recomputed");
    await cached("ordered:0", 60_000, oldest);
    expect(oldest).toHaveBeenCalledTimes(1);
  });

  it("treats a re-fetched key as newest, not as its original position", async () => {
    vi.useFakeTimers();
    // "hot" is written first, so it starts as the oldest entry.
    await cached("hot", 1000, async () => "v1");
    for (let i = 0; i < MAX_ENTRIES - 1; i++) {
      await cached(`filler:${i}`, 60_000, async () => i);
    }
    expect(cacheSize()).toBe(MAX_ENTRIES);

    // Let only "hot" expire, then re-fetch it. That write should move it to the
    // newest position; if it kept its original slot it would still look oldest.
    vi.advanceTimersByTime(2000);
    await cached("hot", 60_000, async () => "v2");

    // One more live key tips the cache over budget, forcing a single eviction.
    await cached("tipping-point", 60_000, async () => "x");

    // The freshly re-fetched key must survive; the genuinely oldest filler goes.
    const hot = vi.fn(async () => "v3");
    await cached("hot", 60_000, hot);
    expect(hot).not.toHaveBeenCalled();

    const evicted = vi.fn(async () => 0);
    await cached("filler:0", 60_000, evicted);
    expect(evicted).toHaveBeenCalledTimes(1);
  });
});
