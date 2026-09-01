import { describe, it, expect } from "vitest";
import { combineMeetup } from "@/lib/meetup";
import type { Deal } from "@/lib/deals";

// Only the fields combineMeetup reads.
function deal(
  flyFrom: string,
  cityTo: string,
  outDate: string,
  price: number
): Deal {
  return {
    flyFrom,
    cityFrom: `city-${flyFrom}`,
    cityTo,
    outDepart: `${outDate}T08:00:00.000Z`,
    backDepart: `${outDate}T20:00:00.000Z`,
    price,
    currency: "EUR",
    deepLink: `https://kiwi/${flyFrom}-${cityTo}-${outDate}`,
  } as unknown as Deal;
}

describe("combineMeetup", () => {
  it("keeps only destinations every origin reaches on the same weekend", () => {
    const cluj = [
      deal("CLJ", "Rome", "2026-10-09", 40), // Fri, weekend of Sat 10 Oct
      deal("CLJ", "Malta", "2026-10-09", 60),
    ];
    const vienna = [
      deal("VIE", "Rome", "2026-10-10", 55), // Sat, SAME weekend
      deal("VIE", "Paris", "2026-10-09", 30), // CLJ can't make Paris
    ];
    const out = combineMeetup([cluj, vienna]);
    expect(out.map((d) => d.cityTo)).toEqual(["Rome"]);
    expect(out[0].price).toBe(95); // 40 + 55, the total
    expect(out[0].meetup?.map((l) => [l.flyFrom, l.price])).toEqual([
      ["CLJ", 40],
      ["VIE", 55],
    ]);
    // The card wears the cheapest leg's itinerary.
    expect(out[0].flyFrom).toBe("CLJ");
  });

  it("different weekends are not a meet-up", () => {
    const a = [deal("CLJ", "Rome", "2026-10-09", 40)];
    const b = [deal("VIE", "Rome", "2026-10-16", 55)]; // one weekend later
    expect(combineMeetup([a, b])).toEqual([]);
  });

  it("picks the cheapest SHARED weekend per destination by total", () => {
    const a = [
      deal("CLJ", "Rome", "2026-10-09", 40),
      deal("CLJ", "Rome", "2026-10-16", 20),
    ];
    const b = [
      deal("VIE", "Rome", "2026-10-09", 30), // total 70
      deal("VIE", "Rome", "2026-10-16", 80), // total 100
    ];
    const out = combineMeetup([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].price).toBe(70);
    expect(out[0].outDepart.startsWith("2026-10-09")).toBe(true);
  });

  it("uses the cheapest fare per origin per weekend before summing", () => {
    const a = [
      deal("CLJ", "Rome", "2026-10-09", 90),
      deal("CLJ", "Rome", "2026-10-10", 35), // same weekend, cheaper
    ];
    const b = [deal("VIE", "Rome", "2026-10-09", 50)];
    const out = combineMeetup([a, b]);
    expect(out[0].price).toBe(85);
  });

  it("three origins intersect all three", () => {
    const a = [deal("CLJ", "Rome", "2026-10-09", 40)];
    const b = [deal("VIE", "Rome", "2026-10-09", 50)];
    const c = [deal("OTP", "Rome", "2026-10-09", 45)];
    const out = combineMeetup([a, b, c]);
    expect(out[0].price).toBe(135);
    expect(out[0].meetup).toHaveLength(3);
    // And dropping one origin's route drops the destination.
    expect(combineMeetup([a, b, [deal("OTP", "Malta", "2026-10-09", 45)]])).toEqual([]);
  });

  it("a single list passes through untouched", () => {
    const a = [deal("CLJ", "Rome", "2026-10-09", 40)];
    expect(combineMeetup([a])).toBe(a);
  });
});
