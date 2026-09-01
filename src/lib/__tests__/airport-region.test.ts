import { describe, it, expect } from "vitest";
import {
  regionOfAirport,
  regionName,
  inferHomeRegion,
} from "@/lib/airport-region";

describe("regionOfAirport", () => {
  it("resolves real airports against the bundled table", () => {
    expect(regionOfAirport("BCN")).toBe("ES-CT");
    expect(regionOfAirport("MUC")).toBe("DE-BY");
    expect(regionOfAirport("CLJ")).toBe("RO-CJ");
    expect(regionOfAirport("bcn")).toBe("ES-CT");
  });

  it("returns null for an unknown code", () => {
    expect(regionOfAirport("ZZZ")).toBeNull();
  });
});

describe("regionName", () => {
  it("names a known region and falls back to the code", () => {
    expect(regionName("ES-CT")).toBe("Catalonia");
    expect(regionName("XX-99")).toBe("XX-99");
  });
});

describe("inferHomeRegion", () => {
  it("answers when every origin agrees on one home-country region", () => {
    expect(inferHomeRegion(["BCN"], "ES")).toBe("ES-CT");
    expect(inferHomeRegion(["BCN", "GRO"], "ES")).toBe("ES-CT");
  });

  it("declines when origins sit in different regions", () => {
    expect(inferHomeRegion(["BCN", "MAD"], "ES")).toBeNull();
  });

  it("declines when an origin lies outside the home country (BSL-class)", () => {
    // BSL's parcel is in France; a Swiss home country must not inherit
    // French regional holidays from it.
    expect(regionOfAirport("BSL")).toMatch(/^FR-/);
    expect(inferHomeRegion(["BSL"], "CH")).toBeNull();
  });

  it("declines when any origin has no region at all", () => {
    expect(inferHomeRegion(["BCN", "ZZZ"], "ES")).toBeNull();
    expect(inferHomeRegion([], "ES")).toBeNull();
  });
});
