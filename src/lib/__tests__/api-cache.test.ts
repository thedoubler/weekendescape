import { describe, it, expect, beforeEach, vi } from "vitest";
import { cached, clearApiCache } from "@/lib/api-cache";

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
