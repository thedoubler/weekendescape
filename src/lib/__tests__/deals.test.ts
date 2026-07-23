import { describe, it, expect } from "vitest";
import {
  flagEmoji,
  normalizeDeals,
  isShortStay,
  isLongWeekend,
  type Deal,
} from "@/lib/deals";

function dealWith(partial: Partial<Deal>): Deal {
  return {
    cityTo: "X",
    countryTo: "",
    flag: "🏳️",
    flyFrom: "BCN",
    flyTo: "XXX",
    countryFromCode: "ES",
    countryToCode: "XX",
    outDepart: "2026-08-08T21:05:00.000Z",
    outArrive: "2026-08-08T22:10:00.000Z",
    backDepart: "2026-08-10T18:00:00.000Z",
    backArrive: "2026-08-10T19:35:00.000Z",
    stayMinutes: 3000,
    nights: 2,
    outStops: 0,
    backStops: 0,
    outLayovers: [],
    backLayovers: [],
    price: 50,
    currency: "EUR",
    deepLink: "x",
    ...partial,
  };
}

describe("isShortStay", () => {
  it("is true for any trip with under a day at the destination", () => {
    // under 24h -> short (regardless of stops)
    expect(isShortStay(dealWith({ outStops: 1, stayMinutes: 600 }))).toBe(true);
    expect(isShortStay(dealWith({ outStops: 0, stayMinutes: 600 }))).toBe(true);
    // a full day or more -> keep
    expect(isShortStay(dealWith({ backStops: 1, stayMinutes: 3000 }))).toBe(
      false
    );
  });
});

describe("isLongWeekend", () => {
  const hol = { date: "2026-08-18", name: "Holiday" };
  it("is true when a home holiday cuts PTO to one day or fewer", () => {
    expect(isLongWeekend(dealWith({ homeHoliday: hol, ptoDays: 0 }))).toBe(true);
    expect(isLongWeekend(dealWith({ homeHoliday: hol, ptoDays: 1 }))).toBe(true);
  });
  it("is false without a holiday or when it still costs two+ days off", () => {
    expect(isLongWeekend(dealWith({ homeHoliday: null, ptoDays: 0 }))).toBe(
      false
    );
    expect(isLongWeekend(dealWith({ homeHoliday: hol, ptoDays: 2 }))).toBe(
      false
    );
    expect(isLongWeekend(dealWith({ homeHoliday: hol }))).toBe(false);
  });
});

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
        flyFrom: "BCN",
        flyTo: "LIS",
        countryFrom: { code: "ES", name: "Spain" },
        countryTo: { code: "PT", name: "Portugal" },
        price: 89,
        deep_link: "https://kiwi.com/deep/lisbon",
        nightsInDest: 2,
        route: [
          { local_departure: "2026-08-21T18:00:00.000Z", local_arrival: "2026-08-21T20:00:00.000Z", return: 0 },
          { local_departure: "2026-08-23T20:00:00.000Z", local_arrival: "2026-08-23T22:00:00.000Z", return: 1 },
        ],
      },
      {
        cityTo: "Ibiza",
        flyFrom: "BCN",
        flyTo: "IBZ",
        countryFrom: { code: "ES", name: "Spain" },
        countryTo: { code: "ES", name: "Spain" },
        price: 37,
        deep_link: "https://kiwi.com/deep/ibiza",
        nightsInDest: 2,
        route: [
          { local_departure: "2026-08-08T21:05:00.000Z", local_arrival: "2026-08-08T22:10:00.000Z", return: 0 },
          { local_departure: "2026-08-10T22:45:00.000Z", local_arrival: "2026-08-10T23:45:00.000Z", return: 1 },
        ],
      },
    ],
  };

  it("extracts airport + country codes and all four times, sorted by price", () => {
    const deals = normalizeDeals(raw, "EUR");
    expect(deals).toHaveLength(2);
    expect(deals[0]).toEqual({
      cityTo: "Ibiza",
      countryTo: "Spain",
      flag: "🇪🇸",
      flyFrom: "BCN",
      flyTo: "IBZ",
      countryFromCode: "ES",
      countryToCode: "ES",
      outDepart: "2026-08-08T21:05:00.000Z",
      outArrive: "2026-08-08T22:10:00.000Z",
      backDepart: "2026-08-10T22:45:00.000Z",
      backArrive: "2026-08-10T23:45:00.000Z",
      stayMinutes: 2915,
      nights: 2,
      outStops: 0,
      backStops: 0,
      outLayovers: [],
      backLayovers: [],
      price: 37,
      currency: "EUR",
      bagPrice: null,
      airlines: [],
      deepLink: "https://kiwi.com/deep/ibiza",
    });
    expect(deals[1].cityTo).toBe("Lisbon");
    expect(deals[1].flyTo).toBe("LIS");
  });

  it("uses the final segment's arrival and reports stops for a layover", () => {
    const layover = {
      data: [
        {
          cityTo: "Alghero",
          flyFrom: "BCN",
          flyTo: "AHO",
          countryFrom: { code: "ES", name: "Spain" },
          countryTo: { code: "IT", name: "Italy" },
          price: 200,
          deep_link: "https://kiwi.com/deep/alghero",
          nightsInDest: 2,
          route: [
            { local_departure: "2026-07-24T20:30:00.000Z", local_arrival: "2026-07-24T21:55:00.000Z", flyTo: "MAD", return: 0 },
            { local_departure: "2026-07-25T01:00:00.000Z", local_arrival: "2026-07-25T02:50:00.000Z", flyTo: "AHO", return: 0 },
            { local_departure: "2026-07-26T03:45:00.000Z", local_arrival: "2026-07-26T05:50:00.000Z", flyTo: "MAD", return: 1 },
            { local_departure: "2026-07-26T07:30:00.000Z", local_arrival: "2026-07-26T08:55:00.000Z", flyTo: "BCN", return: 1 },
          ],
        },
      ],
    };
    const [deal] = normalizeDeals(layover, "EUR");
    // depart origin at first segment, arrive destination at LAST segment
    expect(deal.outDepart).toBe("2026-07-24T20:30:00.000Z");
    expect(deal.outArrive).toBe("2026-07-25T02:50:00.000Z");
    expect(deal.backDepart).toBe("2026-07-26T03:45:00.000Z");
    expect(deal.backArrive).toBe("2026-07-26T08:55:00.000Z");
    expect(deal.outStops).toBe(1);
    expect(deal.backStops).toBe(1);
    // BCN->MAD lands 21:55, MAD->AHO departs next day 01:00 -> 3h05 = 185 min
    expect(deal.outLayovers).toEqual([{ at: "MAD", minutes: 185 }]);
    // AHO->MAD lands 05:50, MAD->BCN departs 07:30 -> 1h40 = 100 min
    expect(deal.backLayovers).toEqual([{ at: "MAD", minutes: 100 }]);
  });

  it("returns an empty array when data is missing", () => {
    expect(normalizeDeals({}, "EUR")).toEqual([]);
    expect(normalizeDeals(null, "EUR")).toEqual([]);
  });

  it("skips items missing airport codes", () => {
    const bad = {
      data: [
        {
          cityTo: "Nowhere",
          countryTo: { code: "XX", name: "" },
          price: 10,
          deep_link: "x",
          route: [
            { local_departure: "2026-08-08T21:05:00.000Z", local_arrival: "2026-08-08T22:10:00.000Z", return: 0 },
            { local_departure: "2026-08-10T22:45:00.000Z", local_arrival: "2026-08-10T23:45:00.000Z", return: 1 },
          ],
        },
      ],
    };
    expect(normalizeDeals(bad, "EUR")).toEqual([]);
  });
});
