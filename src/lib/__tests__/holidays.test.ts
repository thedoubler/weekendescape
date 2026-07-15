import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchHolidays, tripWorkdays, annotate } from "@/lib/holidays";

describe("fetchHolidays", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("maps Nager JSON to {date, name} using the English name", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => [
        { date: "2026-08-15", localName: "Ferragosto", name: "Assumption Day" },
      ],
    } as Response);
    expect(await fetchHolidays("it", 2026)).toEqual([
      { date: "2026-08-15", name: "Assumption Day" },
    ]);
  });

  it("returns [] on a 404 or error", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 404 } as Response);
    expect(await fetchHolidays("zz", 2026)).toEqual([]);
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"));
    expect(await fetchHolidays("es", 2026)).toEqual([]);
  });
});

describe("tripWorkdays", () => {
  it("returns Mon-Fri days in the inclusive span", () => {
    // Fri 2026-08-07 .. Mon 2026-08-10 -> Fri + Mon (Sat/Sun excluded)
    expect(
      tripWorkdays("2026-08-07T20:00:00.000Z", "2026-08-10T06:00:00.000Z")
    ).toEqual(["2026-08-07", "2026-08-10"]);
  });
});

describe("annotate", () => {
  const outArrive = "2026-08-07T20:00:00.000Z"; // Fri
  const backDepart = "2026-08-10T06:00:00.000Z"; // Mon

  it("counts PTO and picks the home holiday that lands on a workday", () => {
    const home = [
      { date: "2026-08-07", name: "Friday Holiday" },
      { date: "2026-08-10", name: "Monday Holiday" },
    ];
    const info = annotate(outArrive, backDepart, home, []);
    expect(info.ptoDays).toBe(0);
    expect(info.homeHoliday).toEqual({ date: "2026-08-07", name: "Friday Holiday" });
    expect(info.destHoliday).toBeNull();
  });

  it("detects a destination holiday anywhere in the span (incl weekend)", () => {
    const dest = [{ date: "2026-08-08", name: "Ferragosto" }]; // Saturday
    const info = annotate(outArrive, backDepart, [], dest);
    expect(info.ptoDays).toBe(2); // Fri + Mon, neither is a home holiday
    expect(info.homeHoliday).toBeNull();
    expect(info.destHoliday).toEqual({ date: "2026-08-08", name: "Ferragosto" });
  });

  it("returns nulls when there are no matching holidays", () => {
    const info = annotate(outArrive, backDepart, [], []);
    expect(info).toEqual({ ptoDays: 2, homeHoliday: null, destHoliday: null });
  });
});
