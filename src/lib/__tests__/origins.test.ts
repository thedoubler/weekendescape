import { describe, it, expect } from "vitest";
import {
  MAX_ORIGINS,
  parseOrigins,
  serializeOrigins,
  originsCacheKey,
  canAddOrigin,
  addOrigin,
  removeOrigin,
} from "@/lib/origins";

describe("parseOrigins", () => {
  it("reads a comma-separated list and uppercases it", () => {
    expect(parseOrigins("bcn,gro")).toEqual(["BCN", "GRO"]);
  });

  it("preserves the user's order rather than sorting", () => {
    // The order is what the chips render in — sorting would reshuffle the UI.
    expect(parseOrigins("GRO,BCN")).toEqual(["GRO", "BCN"]);
  });

  it("drops duplicates and junk instead of failing the whole search", () => {
    // A hand-edited URL shouldn't 400 the board; take what's valid.
    expect(parseOrigins("BCN, bcn ,XX,,BARCELONA,GRO")).toEqual(["BCN", "GRO"]);
  });

  it(`caps at ${MAX_ORIGINS} — each origin multiplies the upstream search`, () => {
    expect(parseOrigins("BCN,GRO,REU,MAD,BIO")).toEqual(["BCN", "GRO", "REU"]);
  });

  it("returns empty for nothing usable", () => {
    expect(parseOrigins(null)).toEqual([]);
    expect(parseOrigins("")).toEqual([]);
    expect(parseOrigins(",,")).toEqual([]);
    expect(parseOrigins("NOPE")).toEqual([]);
  });
});

describe("originsCacheKey", () => {
  it("is order-independent so the same search isn't paid for twice", () => {
    expect(originsCacheKey(["BCN", "GRO"])).toBe(originsCacheKey(["GRO", "BCN"]));
  });

  it("still separates genuinely different sets", () => {
    expect(originsCacheKey(["BCN", "GRO"])).not.toBe(originsCacheKey(["BCN"]));
  });

  it("does not mutate its input", () => {
    const codes = ["GRO", "BCN"];
    originsCacheKey(codes);
    expect(codes).toEqual(["GRO", "BCN"]);
  });
});

describe("add / remove", () => {
  it("adds a valid new code", () => {
    expect(addOrigin(["BCN"], "gro")).toEqual(["BCN", "GRO"]);
  });

  it("refuses duplicates, junk, and anything past the cap", () => {
    expect(canAddOrigin(["BCN"], "BCN")).toBe(false);
    expect(canAddOrigin(["BCN"], "XX")).toBe(false);
    expect(canAddOrigin(["BCN", "GRO", "REU"], "MAD")).toBe(false);
    // …and adding is a no-op rather than a throw.
    expect(addOrigin(["BCN", "GRO", "REU"], "MAD")).toEqual(["BCN", "GRO", "REU"]);
  });

  it("removes case-insensitively", () => {
    expect(removeOrigin(["BCN", "GRO"], "gro")).toEqual(["BCN"]);
  });
});

describe("serializeOrigins", () => {
  it("round-trips through parse", () => {
    const codes = ["BCN", "GRO"];
    expect(parseOrigins(serializeOrigins(codes))).toEqual(codes);
  });
});
