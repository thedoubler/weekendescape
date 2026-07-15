import { describe, it, expect } from "vitest";
import { sortDeals, monthsOf, filterByMonths } from "@/lib/sort";
import type { Deal } from "@/lib/deals";

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
