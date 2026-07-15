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
          { local_departure: "2026-08-21T18:00:00.000Z", return: 0 },
          { local_departure: "2026-08-23T20:00:00.000Z", return: 1 },
        ],
      },
      {
        cityTo: "Rome",
        countryTo: { code: "IT", name: "Italy" },
        price: 55,
        deep_link: "https://kiwi.com/deep/rome",
        nightsInDest: 1,
        route: [
          { local_departure: "2026-09-05T07:30:00.000Z", return: 0 },
          { local_departure: "2026-09-06T21:00:00.000Z", return: 1 },
        ],
      },
    ],
  };

  it("normalizes and sorts ascending by price", () => {
    const deals = normalizeDeals(raw, "EUR");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      cityTo: "Rome",
      countryTo: "Italy",
      flag: "🇮🇹",
      dateOut: "2026-09-05",
      dateBack: "2026-09-06",
      nights: 1,
      price: 55,
      currency: "EUR",
      deepLink: "https://kiwi.com/deep/rome",
    });
    expect(deals[1].cityTo).toBe("Lisbon");
    expect(deals[1].dateOut).toBe("2026-08-21");
    expect(deals[1].dateBack).toBe("2026-08-23");
  });

  it("returns an empty array when data is missing", () => {
    expect(normalizeDeals({}, "EUR")).toEqual([]);
    expect(normalizeDeals(null, "EUR")).toEqual([]);
  });

  it("skips items missing required fields", () => {
    const bad = { data: [{ cityTo: "Nowhere" }] };
    expect(normalizeDeals(bad, "EUR")).toEqual([]);
  });
});
