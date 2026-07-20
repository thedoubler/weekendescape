import { describe, it, expect } from "vitest";
import { airlineName } from "@/lib/airlines";

describe("airlineName", () => {
  it("resolves known IATA codes (case-insensitive)", () => {
    expect(airlineName("LH")).toBe("Lufthansa");
    expect(airlineName("fr")).toBe("Ryanair");
    expect(airlineName("W6")).toBe("Wizz Air");
    // Fresh (Wikidata) names, not OpenFlights' older brand strings.
    expect(airlineName("TP")).toBe("TAP Air Portugal");
    expect(airlineName("KL")).toBe("KLM");
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
    // Flag carriers a reused-code collision would otherwise get wrong.
    expect(airlineName("RO")).toBe("Tarom");
    expect(airlineName("FB")).toBe("Bulgaria Air");
    expect(airlineName("OA")).toBe("Olympic Air");
  });

  it("falls back to the code itself when unknown, and empty for blank", () => {
    // Codes are all two chars, so a three-char token can never be a key.
    expect(airlineName("ZZZ")).toBe("ZZZ");
    expect(airlineName("")).toBe("");
  });
});
