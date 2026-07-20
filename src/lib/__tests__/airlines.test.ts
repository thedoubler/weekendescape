import { describe, it, expect } from "vitest";
import { airlineName } from "@/lib/airlines";

describe("airlineName", () => {
  it("resolves known IATA codes (case-insensitive)", () => {
    expect(airlineName("LH")).toBe("Lufthansa");
    expect(airlineName("fr")).toBe("Ryanair");
    expect(airlineName("W6")).toBe("Wizz Air");
  });

  it("uses the corrected name for stale duplicate codes", () => {
    // OpenFlights still maps VY to the defunct Formosa Airlines; we override it.
    expect(airlineName("VY")).toBe("Vueling");
  });

  it("falls back to the code itself when unknown, and empty for blank", () => {
    // Codes are all two chars, so a three-char token can never be a key.
    expect(airlineName("ZZZ")).toBe("ZZZ");
    expect(airlineName("")).toBe("");
  });
});
