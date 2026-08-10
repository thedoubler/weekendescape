import { describe, it, expect } from "vitest";
import {
  legAirMinutes,
  layoverFlags,
  costRows,
  weekendSaving, comparable } from "@/lib/trip-facts";
import type { Deal } from "@/lib/deals";

function deal(over: Partial<Deal> = {}): Deal {
  return {
    cityTo: "Memmingen",
    cityFrom: "Barcelona",
    countryTo: "Germany",
    flag: "🇩🇪",
    flyFrom: "BCN",
    flyTo: "FMM",
    countryFrom: "Spain",
    segments: [],
    countryFromCode: "ES",
    countryToCode: "DE",
    outDepart: "2026-10-02T06:20",
    outArrive: "2026-10-02T08:25",
    backDepart: "2026-10-04T20:10",
    backArrive: "2026-10-04T22:25",
    stayMinutes: 3585,
    nights: 2,
    outStops: 0,
    backStops: 0,
    outLayovers: [],
    backLayovers: [],
    price: 63,
    currency: "EUR",
    deepLink: "https://kiwi.com/x",
    ...over,
  };
}

describe("legAirMinutes", () => {
  it("uses the upstream duration when present", () => {
    // The live bug this exists to fix: BCN 09:35 (UTC+2) → LTN 10:55 (UTC+1) is
    // 2h20 of flying, but subtracting local wall-clock times gives 1h20.
    const wallClock = legAirMinutes(null, "2026-10-02T09:35", "2026-10-02T10:55");
    expect(wallClock).toBe(80);
    const real = legAirMinutes(140, "2026-10-02T09:35", "2026-10-02T10:55");
    expect(real).toBe(140);
  });

  it("falls back to wall clock when upstream omits it", () => {
    expect(legAirMinutes(undefined, "2026-10-02T06:20", "2026-10-02T08:25")).toBe(125);
  });
});

describe("layoverFlags", () => {
  it("flags a connection too tight to absorb a delay", () => {
    const f = layoverFlags(deal({ outLayovers: [{ at: "VIE", minutes: 55 }] }));
    expect(f).toEqual([{ at: "VIE", minutes: 55, kind: "tight" }]);
  });

  it("flags a stop long enough to lose a half-day", () => {
    const f = layoverFlags(deal({ backLayovers: [{ at: "MUC", minutes: 300 }] }));
    expect(f[0].kind).toBe("long");
  });

  it("stays silent on a comfortable connection", () => {
    // The flags only mean something if most trips show none.
    expect(layoverFlags(deal({ outLayovers: [{ at: "MUC", minutes: 120 }] }))).toEqual([]);
  });
});

describe("costRows", () => {
  it("totals fare plus bag for a single traveller", () => {
    const rows = costRows(deal({ bagPrice: 63 }), 1);
    expect(rows.map((r) => r.value)).toEqual(["63 EUR", "+63 EUR", "126 EUR"]);
    expect(rows[2].total).toBe(true);
  });

  it("omits the total when the bag price is unknown", () => {
    // Never imply an all-in figure we cannot stand behind.
    const rows = costRows(deal({ bagPrice: null }), 1);
    expect(rows).toHaveLength(1);
    expect(rows.some((r) => r.total)).toBe(false);
  });

  it("shows per-person and no bag maths for a party", () => {
    // `price` is a party total; bag per-person vs per-booking is unverified.
    const rows = costRows(deal({ price: 200, bagPrice: 63 }), 2);
    expect(rows[1]).toEqual({ label: "Per person", value: "100 EUR" });
    expect(rows.some((r) => r.total)).toBe(false);
    expect(rows.some((r) => r.value.includes("63"))).toBe(false);
  });

  it("omits the bag rows when the bag is free", () => {
    const rows = costRows(deal({ bagPrice: 0 }), 1);
    expect(rows).toHaveLength(1);
  });
});

// framedPins lives in the map component (it needs the Pin shape), so it is
// exercised here through its own module import.
describe("framedPins", () => {
  it("keeps a long-haul outlier out of the camera framing", async () => {
    const { framedPins } = await import("@/components/DealsMapGL");
    const BCN: [number, number] = [41.3, 2.08];
    const near = Array.from({ length: 8 }, (_, i) => ({
      key: `E${i}`, city: `City${i}`, price: 40 + i, currency: "EUR",
      lat: 45 + i * 0.5, lon: 5 + i * 0.5, extra: 0, fromCode: "BCN",
    }));
    const brazil = {
      key: "GRU", city: "Sao Paulo", price: 1429, currency: "EUR",
      lat: -23.4, lon: -46.5, extra: 0, fromCode: "BCN",
    };
    const kept = framedPins([...near, brazil], BCN);
    expect(kept.map((p) => p.key)).not.toContain("GRU");
    expect(kept).toHaveLength(8);
  });

  it("keeps everything when the spread is tight", async () => {
    const { framedPins } = await import("@/components/DealsMapGL");
    const BCN: [number, number] = [41.3, 2.08];
    const pins = Array.from({ length: 6 }, (_, i) => ({
      key: `E${i}`, city: `City${i}`, price: 40, currency: "EUR",
      lat: 45 + i * 0.3, lon: 5 + i * 0.3, extra: 0, fromCode: "BCN",
    }));
    expect(framedPins(pins, BCN)).toHaveLength(6);
  });

  it("does not filter a sample too small to have a meaningful median", async () => {
    const { framedPins } = await import("@/components/DealsMapGL");
    const pins = [
      { key: "A", city: "A", price: 1, currency: "EUR", lat: 45, lon: 5, extra: 0, fromCode: "BCN" },
      { key: "B", city: "B", price: 2, currency: "EUR", lat: -23, lon: -46, extra: 0, fromCode: "BCN" },
    ];
    expect(framedPins(pins, [41.3, 2.08])).toHaveLength(2);
  });
});


describe("weekendSaving", () => {
  const cur = () =>
    deal({ price: 41, bagPrice: 64, outDepart: "2026-10-02T06:20", backDepart: "2026-10-04T20:10" });
  const alt = (over: Partial<Deal>) =>
    deal({ outDepart: "2026-10-09T06:20", backDepart: "2026-10-11T20:10", ...over });

  it("stays silent on a saving too small to act on", () => {
    // The motivating case: 4 EUR off a 41 EUR fare was being sold as
    // "10% cheaper" next to a 64 EUR bag fee.
    expect(weekendSaving(cur(), alt({ price: 37, bagPrice: 64 }), 1)).toBeNull();
  });

  it("compares all-in when both sides have a bag price", () => {
    // 105 vs 82 all-in — a 23 EUR saving, not the 19 the fares alone suggest.
    const s = weekendSaving(cur(), alt({ price: 22, bagPrice: 60 }), 1);
    expect(s).toEqual({ amount: 23, pct: 22, allIn: true });
  });

  it("refuses to claim an all-in saving when a bag price is unknown", () => {
    const s = weekendSaving(cur(), alt({ price: 20, bagPrice: null }), 1);
    expect(s!.allIn).toBe(false);
    expect(s!.amount).toBe(21); // fare-only: 41 - 20
  });

  it("falls back to fare-only for a party, matching costRows", () => {
    const s = weekendSaving(cur(), alt({ price: 20, bagPrice: 60 }), 2);
    expect(s!.allIn).toBe(false);
  });

  it("never calls the same weekend a cheaper weekend", () => {
    const same = alt({
      price: 10,
      outDepart: "2026-10-02T06:20",
      backDepart: "2026-10-04T20:10",
    });
    expect(weekendSaving(cur(), same, 1)).toBeNull();
  });

  it("ignores a dearer alternative and a currency mismatch", () => {
    expect(weekendSaving(cur(), alt({ price: 90 }), 1)).toBeNull();
    expect(
      weekendSaving(cur(), alt({ price: 5, currency: "GBP" }), 1)
    ).toBeNull();
  });
});

describe("cheaper-weekend row consistency", () => {
  // Regression: the panel showed an ALL-IN saving beside the alternative's bare
  // FARE, so the three numbers on screen could not be reconciled —
  // "153 EUR total ... 50 EUR less ... 39 EUR". Whatever basis weekendSaving
  // used, `comparable` must return the matching figure to print.
  it("saving and displayed price share one basis", () => {
    const current = {
      price: 100,
      bagPrice: 53,
      currency: "EUR",
      outDepart: "2026-10-02T07:00",
      backDepart: "2026-10-04T18:00",
    } as never as Parameters<typeof weekendSaving>[0];
    const alternative = {
      price: 39,
      bagPrice: 64,
      currency: "EUR",
      outDepart: "2026-10-09T07:00",
      backDepart: "2026-10-11T18:00",
    } as never as Parameters<typeof weekendSaving>[1];

    const saving = weekendSaving(current, alternative, 1)!;
    expect(saving).not.toBeNull();
    expect(saving.allIn).toBe(true);

    const currentAllIn = comparable(100, 53, 1).value; // 153
    const shown = comparable(39, 64, 1).value; // 103
    expect(currentAllIn).toBe(153);
    expect(shown).toBe(103);
    // The reader must be able to do this subtraction in their head.
    expect(currentAllIn - saving.amount).toBe(shown);
  });
});
