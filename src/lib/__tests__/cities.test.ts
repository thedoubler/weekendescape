import { describe, it, expect } from "vitest";
import { cityCoords, haversineKm, airportCityKm } from "@/lib/cities";

describe("haversineKm", () => {
  it("computes a known distance (Brussels centre -> Charleroi airport)", () => {
    const brussels: [number, number] = [50.85, 4.35];
    const crl: [number, number] = [50.459, 4.453];
    expect(haversineKm(brussels, crl)).toBeCloseTo(44, 0);
  });

  it("is zero for identical points", () => {
    expect(haversineKm([40, -3], [40, -3])).toBe(0);
  });
});

describe("cityCoords", () => {
  it("resolves a city by name + country (case/accent-insensitive)", () => {
    const c = cityCoords("Brussels", "be");
    expect(c).not.toBeNull();
    expect(c![0]).toBeCloseTo(50.85, 1);
  });

  it("resolves English exonyms of major cities", () => {
    expect(cityCoords("Munich", "DE")).not.toBeNull();
    expect(cityCoords("Cologne", "DE")).not.toBeNull();
  });

  it("returns null for unknown cities or missing args", () => {
    expect(cityCoords("Nowhereville", "ZZ")).toBeNull();
    expect(cityCoords("", "BE")).toBeNull();
  });
});

describe("airportCityKm", () => {
  it("flags a secondary airport far from its marketed city", () => {
    const km = airportCityKm("CRL", "Brussels", "BE");
    expect(km).not.toBeNull();
    expect(km!).toBeGreaterThan(35);
    expect(km!).toBeLessThan(55);
  });

  it("reports a small distance for a city's primary airport", () => {
    const km = airportCityKm("OPO", "Porto", "PT");
    expect(km).not.toBeNull();
    expect(km!).toBeLessThan(20);
  });

  it("returns null when the airport or city is unknown", () => {
    expect(airportCityKm("ZZZ", "Brussels", "BE")).toBeNull();
    expect(airportCityKm("CRL", "Nowhereville", "ZZ")).toBeNull();
  });
});
