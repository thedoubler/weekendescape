import { describe, it, expect } from "vitest";
import { flagEmoji, normalizeDeals } from "@/lib/deals";

describe("flagEmoji", () => {
  it("converts an ISO country code to a flag emoji", () => {
    expect(flagEmoji("ES")).toBe("🇪🇸");
    expect(flagEmoji("gb")).toBe("🇬🇧");
  });
  it("falls back to a white flag on bad input", () => {
    expect(flagEmoji("")).toBe("🏳️");
    expect(flagEmoji("X")).toBe("🏳️");
  });
});

describe("normalizeDeals", () => {
  const raw = {
    data: [
      {
        cityTo: "Lisbon",
        countryTo: { code: "PT", name: "Portugal" },
        price: 89,
        deep_link: "https://kiwi.com/deep/lisbon",
        nightsInDest: 2,
        route: [
          {
            local_departure: "2026-08-21T18:00:00.000Z",
            local_arrival: "2026-08-21T20:00:00.000Z",
            return: 0,
          },
          {
            local_departure: "2026-08-23T20:00:00.000Z",
            local_arrival: "2026-08-23T22:00:00.000Z",
            return: 1,
          },
        ],
      },
      {
        cityTo: "Ibiza",
        countryTo: { code: "ES", name: "Spain" },
        price: 37,
        deep_link: "https://kiwi.com/deep/ibiza",
        nightsInDest: 2,
        route: [
          {
            local_departure: "2026-08-08T21:05:00.000Z",
            local_arrival: "2026-08-08T22:10:00.000Z",
            return: 0,
          },
          {
            local_departure: "2026-08-10T22:45:00.000Z",
            local_arrival: "2026-08-10T23:45:00.000Z",
            return: 1,
          },
        ],
      },
    ],
  };

  it("extracts all four flight times and computes stayMinutes, sorted by price", () => {
    const deals = normalizeDeals(raw, "EUR");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      cityTo: "Ibiza",
      countryTo: "Spain",
      flag: "🇪🇸",
      outDepart: "2026-08-08T21:05:00.000Z",
      outArrive: "2026-08-08T22:10:00.000Z",
      backDepart: "2026-08-10T22:45:00.000Z",
      backArrive: "2026-08-10T23:45:00.000Z",
      stayMinutes: 2915,
      nights: 2,
      price: 37,
      currency: "EUR",
      deepLink: "https://kiwi.com/deep/ibiza",
    });
    expect(deals[1].cityTo).toBe("Lisbon");
  });

  it("returns an empty array when data is missing", () => {
    expect(normalizeDeals({}, "EUR")).toEqual([]);
    expect(normalizeDeals(null, "EUR")).toEqual([]);
  });

  it("skips items missing a leg time", () => {
    const bad = {
      data: [
        {
          cityTo: "Nowhere",
          countryTo: { code: "XX", name: "" },
          price: 10,
          deep_link: "x",
          route: [{ local_departure: "2026-08-08T21:05:00.000Z", return: 0 }],
        },
      ],
    };
    expect(normalizeDeals(bad, "EUR")).toEqual([]);
  });
});
