import { describe, it, expect } from "vitest";
import { baggageInfo, isSevereBagFee } from "@/lib/baggage";
import type { Deal } from "@/lib/deals";

function deal(over: Partial<Deal> = {}): Deal {
  return {
    cityTo: "Budapest",
    cityFrom: "Barcelona",
    countryTo: "Hungary",
    flag: "🇭🇺",
    flyFrom: "BCN",
    flyTo: "BUD",
    countryFrom: "Spain",
    segments: [],
    countryFromCode: "ES",
    countryToCode: "HU",
    outDepart: "2026-09-11T20:00",
    outArrive: "2026-09-11T22:30",
    backDepart: "2026-09-13T18:00",
    backArrive: "2026-09-13T20:30",
    stayMinutes: 2610,
    nights: 2,
    outStops: 0,
    backStops: 0,
    outLayovers: [],
    backLayovers: [],
    price: 49,
    currency: "EUR",
    deepLink: "https://kiwi.com/x",
    ...over,
  };
}

describe("isSevereBagFee", () => {
  it("flags a fee that dwarfs the fare", () => {
    // The motivating case: a 165 EUR bag against a 49 EUR fare means the
    // advertised price is a fraction of what you'd actually pay.
    expect(isSevereBagFee(165, 49)).toBe(true);
  });

  it("stays quiet for an ordinary ancillary", () => {
    expect(isSevereBagFee(30, 80)).toBe(false);
  });

  it("stays quiet at the market median", () => {
    // A bag at ~0.85x the fare is the MEDIAN on a real board, not an outlier.
    // If this ever returns true the threshold has drifted below typical and the
    // colour will fire on most cards, which is the failure mode it exists to
    // avoid. Measured 2026-07-27: p25 0.58, median 0.85, p75 1.25.
    expect(isSevereBagFee(42, 49)).toBe(false); // 0.86x — median-ish
    expect(isSevereBagFee(61, 49)).toBe(false); // 1.24x — around p75
  });

  it("stays quiet when a cheap fare has a cheap bag", () => {
    // Trips the ratio but not the absolute floor.
    expect(isSevereBagFee(15, 10)).toBe(false);
  });

  it("fires exactly at both boundaries", () => {
    expect(isSevereBagFee(75, 50)).toBe(true); // ratio ==, above floor
    expect(isSevereBagFee(74, 50)).toBe(false); // just below ratio
    expect(isSevereBagFee(24, 16)).toBe(false); // ratio met, below floor
  });
});

describe("baggageInfo", () => {
  it("never claims a cabin allowance we cannot know", () => {
    // Regression guard: the old copy said "Cabin bag only", which is wrong on
    // carriers whose base fare covers just an under-seat item. All we actually
    // have is the price to ADD a checked bag.
    const info = baggageInfo(deal({ bagPrice: 165 }), 1);
    expect(info.full).not.toMatch(/cabin bag only/i);
    expect(info.full).toMatch(/cabin allowance is set by the airline/i);
    expect(info.severe).toBe(true);
  });

  it("states the figure with its currency", () => {
    // The details line stands alone, away from the price, so it must carry the
    // unit itself.
    const info = baggageInfo(deal({ bagPrice: 165 }), 1);
    expect(info.full).toMatch(/165 EUR/);
  });

  it("speaks the unknown state aloud instead of rendering nothing", () => {
    const info = baggageInfo(deal({ bagPrice: null }), 1);
    // Must never imply "no bag fee" when the answer is simply unknown.
    expect(info.full).toMatch(/not shown for this fare/i);
    expect(info.full).not.toMatch(/included/i);
  });

  it("treats an included bag as neutral, not as a warning", () => {
    const info = baggageInfo(deal({ bagPrice: 0 }), 1);
    expect(info.full).toMatch(/included in the fare/i);
    expect(info.severe).toBe(false);
  });

  it("drops the number for groups while the per-person semantics are unverified", () => {
    // `price` is a party total; whether bagPrice is per-bag or per-booking is
    // not established. Printing a figure would repeat the per-person/total
    // ambiguity rather than resolve it.
    const info = baggageInfo(deal({ bagPrice: 165 }), 2);
    expect(info.full).not.toMatch(/165/);
    expect(info.severe).toBe(false);
  });

  it("refuses to quote one figure across two airlines with a connection", () => {
    const info = baggageInfo(
      deal({ bagPrice: 165, airlines: ["W6", "HV"], outStops: 1 }),
      1
    );
    expect(info.full).toMatch(/may differ per airline/i);
    expect(info.full).not.toMatch(/165/);
    // Hedged, not alarming — we are declining to claim, not warning.
    expect(info.severe).toBe(false);
  });

  it("still quotes a figure for two airlines on a direct round trip", () => {
    // Different carrier each way with no connection is not the interlining
    // shape, so a single figure is still meaningful.
    const info = baggageInfo(deal({ bagPrice: 165, airlines: ["W6", "HV"] }), 1);
    expect(info.full).toMatch(/165 EUR/);
  });
});
