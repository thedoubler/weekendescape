import { describe, it, expect } from "vitest";
import { currencyForOrigin } from "@/lib/currency";
describe("currencyForOrigin", () => {
  it("prices European origins in EUR", () => {
    for (const c of ["CLJ","BCN","LTN","WAW","OSL","IST","KEF"]) expect(currencyForOrigin(c)).toBe("EUR");
  });
  it("prices everywhere else in USD", () => {
    for (const c of ["JFK","LAX","BKK","DXB","GRU","NRT"]) expect(currencyForOrigin(c)).toBe("USD");
  });
  it("falls back to EUR for an unknown code", () => {
    expect(currencyForOrigin("ZZZ")).toBe("EUR");
  });
});
