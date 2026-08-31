import { describe, it, expect } from "vitest";
import {
  weekendKey,
  isTripDay,
  dealsByWeekend,
  calendarMonths,
} from "@/lib/calendar";
import type { Deal } from "@/lib/deals";

const base = {
  cityFrom: "Cluj-Napoca",
  countryTo: "Italy",
  flag: "🇮🇹",
  flyFrom: "CLJ",
  countryFrom: "Romania",
  segments: [],
  countryFromCode: "RO",
  countryToCode: "IT",
  stayMinutes: 2915,
  nights: 2,
  outStops: 0,
  backStops: 0,
  outLayovers: [],
  backLayovers: [],
  currency: "EUR",
  deepLink: "https://kiwi.com/x",
} as unknown as Deal;

function deal(city: string, out: string, price: number): Deal {
  return {
    ...base,
    cityTo: city,
    flyTo: city.slice(0, 3).toUpperCase(),
    outDepart: `${out}T07:00:00.000Z`,
    outArrive: `${out}T09:00:00.000Z`,
    backDepart: `${out}T20:00:00.000Z`,
    backArrive: `${out}T22:00:00.000Z`,
    price,
  } as Deal;
}

describe("weekendKey", () => {
  it("anchors on Saturday so a whole weekend shares one key", () => {
    // Fri 20, Sat 21, Sun 22 Nov 2026 are one weekend.
    expect(weekendKey("2026-11-20")).toBe("2026-11-21");
    expect(weekendKey("2026-11-21")).toBe("2026-11-21");
    expect(weekendKey("2026-11-22")).toBe("2026-11-21");
  });

  it("gives a month-straddling weekend a single home", () => {
    // Fri 30 Oct and Sun 1 Nov both belong to Sat 31 Oct. A Friday or Sunday
    // anchor would file them under different months.
    expect(weekendKey("2026-10-30")).toBe("2026-10-31");
    expect(weekendKey("2026-11-01")).toBe("2026-10-31");
  });

  it("sends midweek days forward, not back, from Wednesday on", () => {
    expect(weekendKey("2026-11-16")).toBe("2026-11-14"); // Mon -> weekend just gone
    expect(weekendKey("2026-11-18")).toBe("2026-11-21"); // Wed -> weekend ahead
  });
});

describe("isTripDay", () => {
  // weekendKey deliberately maps every weekday to a weekend, so it cannot also
  // be the test for "is this a day I am away" — used that way it tinted all
  // seven days of any week containing a flight: 70 lit days for 14 deals.
  it("is true only for Fri, Sat and Sun", () => {
    expect(isTripDay("2026-11-20")).toBe(true); // Fri
    expect(isTripDay("2026-11-21")).toBe(true); // Sat
    expect(isTripDay("2026-11-22")).toBe(true); // Sun
    expect(isTripDay("2026-11-18")).toBe(false); // Wed
    expect(isTripDay("2026-11-19")).toBe(false); // Thu
    expect(isTripDay("2026-11-23")).toBe(false); // Mon
  });
});

describe("dealsByWeekend", () => {
  it("groups a Fri and a Sun departure together, cheapest first", () => {
    const g = dealsByWeekend([
      deal("Rome", "2026-11-22", 90),
      deal("Milan", "2026-11-20", 33),
    ]);
    expect([...g.keys()]).toEqual(["2026-11-21"]);
    expect(g.get("2026-11-21")!.map((d) => d.cityTo)).toEqual(["Milan", "Rome"]);
  });
});

describe("calendarMonths", () => {
  it("keeps an empty month in the span instead of deleting it", () => {
    // December has no flights. Dropping it left the calendar reading
    // "November, January", which reads as a bug rather than as an empty month —
    // so the month stays, flagged, and the view says so in words.
    const ms = calendarMonths([
      deal("Milan", "2026-11-20", 33),
      deal("Rome", "2027-01-15", 90),
    ]);
    expect(ms.map((m) => m.key)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(ms.map((m) => m.hasDeals)).toEqual([true, false, true]);
    expect(ms[0].title).toBe("November 2026");
    expect(ms[1].title).toBe("December 2026");
  });

  it("spans no further than the last month with a deal", () => {
    // The span ends where the data ends: a sequence that stops reads as the end
    // of the results, while a hole in the middle reads as something broken.
    const ms = calendarMonths([deal("Milan", "2026-11-20", 33)]);
    expect(ms.map((m) => m.key)).toEqual(["2026-11"]);
  });

  it("returns nothing when there are no deals at all", () => {
    expect(calendarMonths([])).toEqual([]);
  });

  it("lays out Monday-first with every week exactly 7 cells", () => {
    const [m] = calendarMonths([deal("Milan", "2026-11-20", 33)]);
    for (const w of m.weeks) expect(w).toHaveLength(7);
    // 1 Nov 2026 is a Sunday, so Monday-first needs SIX pad cells — the case a
    // naive getUTCDay() would render as zero and shift the whole month.
    expect(m.weeks[0].slice(0, 6).every((c) => c.date === "")).toBe(true);
    expect(m.weeks[0][6].day).toBe(1);
  });

  it("keeps Saturday and Sunday adjacent, so a weekend never splits a row", () => {
    const [m] = calendarMonths([deal("Milan", "2026-11-20", 33)]);
    const row = m.weeks.find((w) => w.some((c) => c.day === 21))!;
    const sat = row.findIndex((c) => c.day === 21);
    expect(sat).toBe(5);
    expect(row[6].day).toBe(22);
  });
});
