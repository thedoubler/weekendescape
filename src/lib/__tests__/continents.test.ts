import { describe, it, expect } from "vitest";
import {
  continentOf,
  continentsOf,
  filterByContinents,
} from "@/lib/continents";
import type { Deal } from "@/lib/deals";

function d(countryToCode: string): Deal {
  return {
    cityTo: "X",
    countryTo: "",
    flag: "🏳️",
    flyFrom: "BCN",
    flyTo: "XXX",
    countryFromCode: "ES",
    countryToCode,
    outDepart: "2026-08-08T21:05:00.000Z",
    outArrive: "2026-08-08T22:10:00.000Z",
    backDepart: "2026-08-10T18:00:00.000Z",
    backArrive: "2026-08-10T19:35:00.000Z",
    stayMinutes: 100,
    outStops: 0,
    backStops: 0,
    outLayovers: [],
    backLayovers: [],
    nights: 1,
    price: 50,
    currency: "EUR",
    deepLink: "x",
  };
}

describe("continentOf", () => {
  it("maps country codes to continents, grouping the Americas", () => {
    expect(continentOf("ES")).toBe("Europe");
    expect(continentOf("jp")).toBe("Asia");
    expect(continentOf("EG")).toBe("Africa");
    expect(continentOf("US")).toBe("Americas");
    expect(continentOf("BR")).toBe("Americas");
    expect(continentOf("AU")).toBe("Oceania");
    expect(continentOf("ZZ")).toBe("");
  });
});

describe("continentsOf", () => {
  it("returns the distinct present continents in display order", () => {
    expect(continentsOf([d("US"), d("IT"), d("BR"), d("ES")])).toEqual([
      "Europe",
      "Americas",
    ]);
  });
});

describe("filterByContinents", () => {
  const deals = [d("IT"), d("US"), d("JP")];
  it("empty selection returns all", () => {
    expect(filterByContinents(deals, [])).toHaveLength(3);
  });
  it("keeps only deals in the selected continents", () => {
    expect(
      filterByContinents(deals, ["Europe", "Asia"]).map((x) => x.countryToCode)
    ).toEqual(["IT", "JP"]);
  });
});
