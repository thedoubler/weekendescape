import { describe, it, expect } from "vitest";
import { timelineRange } from "@/lib/timeline";

describe("timelineRange", () => {
  it("formats today and today+months as dd/mm/yyyy", () => {
    const today = new Date(2026, 6, 14); // 14 Jul 2026 (month is 0-based)
    expect(timelineRange(3, today)).toEqual({
      dateFrom: "14/07/2026",
      dateTo: "14/10/2026",
    });
  });

  it("rolls over the year", () => {
    const today = new Date(2026, 10, 20); // 20 Nov 2026
    expect(timelineRange(3, today)).toEqual({
      dateFrom: "20/11/2026",
      dateTo: "20/02/2027",
    });
  });

  it("pads single-digit day and month", () => {
    const today = new Date(2026, 0, 5); // 5 Jan 2026
    expect(timelineRange(1, today)).toEqual({
      dateFrom: "05/01/2026",
      dateTo: "05/02/2026",
    });
  });
});
