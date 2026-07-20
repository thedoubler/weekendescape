import { describe, it, expect } from "vitest";
import {
  sortDeals,
  monthsOf,
  filterByMonths,
  priceRange,
  filterByMaxPrice,
  filterByMaxAirportKm,
  farAirportCount,
} from "@/lib/sort";
import type { Deal } from "@/lib/deals";

function withKm(deal: Deal, km: number | null): Deal {
  return { ...deal, airportKmFromCity: km };
}

function d(cityTo: string, outDepart: string, price: number): Deal {
  return {
    cityTo,
    countryTo: "",
    flag: "🏳️",
    flyFrom: "BCN",
    flyTo: "XXX",
    countryFromCode: "ES",
    countryToCode: "XX",
    outDepart,
    outArrive: outDepart,
    backDepart: outDepart,
    backArrive: outDepart,
    stayMinutes: 0,
    outStops: 0,
    backStops: 0,
    outLayovers: [],
    backLayovers: [],
    nights: 1,
    price,
    currency: "EUR",
    deepLink: "x",
  };
}

const deals = [
  d("Rome", "2026-09-05T07:00:00.000Z", 55),
  d("Ibiza", "2026-08-08T21:00:00.000Z", 37),
  d("Paris", "2026-08-22T06:00:00.000Z", 37),
];

describe("airport-distance filter", () => {
  const list = [
    withKm(d("Near", "2026-09-01T00:00", 10), 8),
    withKm(d("Far", "2026-09-01T00:00", 10), 90),
    withKm(d("Unknown", "2026-09-01T00:00", 10), null),
  ];
  it("keeps in-town and unknown-distance deals", () => {
    expect(filterByMaxAirportKm(list, 30).map((x) => x.cityTo)).toEqual([
      "Near",
      "Unknown",
    ]);
  });
  it("counts only deals known to be far", () => {
    expect(farAirportCount(list, 30)).toBe(1);
  });
});

describe("sortDeals", () => {
  it("soonest orders by departure, tie-break price", () => {
    expect(sortDeals(deals, "soonest").map((x) => x.cityTo)).toEqual([
      "Ibiza",
      "Paris",
      "Rome",
    ]);
  });
  it("cheapest orders by price, tie-break departure", () => {
    expect(sortDeals(deals, "cheapest").map((x) => x.cityTo)).toEqual([
      "Ibiza",
      "Paris",
      "Rome",
    ]);
  });
  it("closest orders by airport distance, unknowns last", () => {
    const withDist = [
      withKm(d("Far", "2026-09-01T00:00", 50), 90),
      withKm(d("Near", "2026-09-01T00:00", 60), 8),
      withKm(d("Unknown", "2026-09-01T00:00", 40), null),
      withKm(d("Mid", "2026-09-01T00:00", 70), 30),
    ];
    expect(sortDeals(withDist, "closest").map((x) => x.cityTo)).toEqual([
      "Near",
      "Mid",
      "Far",
      "Unknown",
    ]);
  });
  it("does not mutate the input", () => {
    const copy = [...deals];
    sortDeals(deals, "cheapest");
    expect(deals).toEqual(copy);
  });
});

describe("monthsOf", () => {
  it("returns distinct months ascending", () => {
    expect(monthsOf(deals)).toEqual(["2026-08", "2026-09"]);
  });
});

describe("priceRange", () => {
  it("returns the min and max price", () => {
    expect(priceRange(deals)).toEqual({ min: 37, max: 55 });
  });
  it("returns zeros for an empty list", () => {
    expect(priceRange([])).toEqual({ min: 0, max: 0 });
  });
});

describe("filterByMaxPrice", () => {
  it("keeps deals at or below the max price", () => {
    expect(filterByMaxPrice(deals, 40).map((x) => x.cityTo).sort()).toEqual([
      "Ibiza",
      "Paris",
    ]);
  });
  it("keeps everything when the cap is the max", () => {
    expect(filterByMaxPrice(deals, 55)).toHaveLength(3);
  });
});

describe("filterByMonths", () => {
  it("empty selection returns all", () => {
    expect(filterByMonths(deals, [])).toHaveLength(3);
  });
  it("keeps only deals departing in selected months", () => {
    expect(filterByMonths(deals, ["2026-09"]).map((x) => x.cityTo)).toEqual([
      "Rome",
    ]);
  });
});
