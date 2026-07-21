import { describe, it, expect } from "vitest";
import { estimateFlightCo2Kg, isLowCo2 } from "@/lib/co2";

describe("estimateFlightCo2Kg", () => {
  it("estimates a short-haul round trip in a sensible range", () => {
    // BCN -> MXP (Milan) is ~725 km each way; a round-trip economy estimate
    // should land in the low-hundreds of kg.
    const kg = estimateFlightCo2Kg("BCN", "MXP");
    expect(kg).not.toBeNull();
    expect(kg!).toBeGreaterThan(150);
    expect(kg!).toBeLessThan(350);
  });

  it("is larger for a longer route", () => {
    const near = estimateFlightCo2Kg("BCN", "MXP")!; // ~725 km
    const far = estimateFlightCo2Kg("BCN", "JFK")!; // ~6100 km
    expect(far).toBeGreaterThan(near * 3);
  });

  it("rounds to the nearest 5 kg", () => {
    const kg = estimateFlightCo2Kg("BCN", "MXP")!;
    expect(kg % 5).toBe(0);
  });

  it("returns null when an airport is unknown", () => {
    expect(estimateFlightCo2Kg("BCN", "ZZZ")).toBeNull();
    expect(estimateFlightCo2Kg("", "MXP")).toBeNull();
  });
});

describe("isLowCo2", () => {
  it("flags short-haul weekend trips as low", () => {
    expect(isLowCo2(150)).toBe(true);
    expect(isLowCo2(200)).toBe(true);
    expect(isLowCo2(400)).toBe(false);
  });
});
