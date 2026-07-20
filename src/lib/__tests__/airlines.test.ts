import { describe, it, expect } from "vitest";
import { airlineName } from "@/lib/airlines";

describe("airlineName", () => {
  it("resolves known IATA codes (case-insensitive)", () => {
    expect(airlineName("LH")).toBe("Lufthansa");
    expect(airlineName("fr")).toBe("Ryanair");
    expect(airlineName("W6")).toBe("Wizz Air");
  });

  it("uses the corrected name for stale/reassigned codes", () => {
    // OpenFlights predates the current low-cost AOCs, so these codes resolve to
    // defunct carriers (VY->Formosa, W4->AeroWorld, RK->Air Afrique) without the
    // overrides.
    expect(airlineName("VY")).toBe("Vueling");
    expect(airlineName("W4")).toBe("Wizz Air");
    expect(airlineName("W9")).toBe("Wizz Air");
    expect(airlineName("RK")).toBe("Ryanair");
    expect(airlineName("AL")).toBe("Ryanair");
  });

  it("falls back to the code itself when unknown, and empty for blank", () => {
    // Codes are all two chars, so a three-char token can never be a key.
    expect(airlineName("ZZZ")).toBe("ZZZ");
    expect(airlineName("")).toBe("");
  });
});
