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

describe("airlineName — recycled IATA codes", () => {
  it("names the carrier flying today, not the one that folded", () => {
    // A2 belonged to African Safari Airways, which stopped flying around 2010.
    // Printing it on a Romanian route is a confident, wrong fact.
    expect(airlineName("A2")).toBe("Animawings");
    expect(airlineName("a2")).toBe("Animawings");
    expect(airlineName("H4")).toBe("HiSky");
    expect(airlineName("BZ")).toBe("Blue Bird Airways");
  });

  it("shows the bare code when the table is known-wrong but unverified", () => {
    // Unhelpful beats misleading: better "LL" than a US charter that shut in 2020.
    expect(airlineName("LL")).toBe("LL");
    expect(airlineName("DN")).toBe("DN");
  });

  it("leaves correct entries alone", () => {
    expect(airlineName("VY")).toBe("Vueling");
    expect(airlineName("W6")).toBe("Wizz Air");
  });
});

