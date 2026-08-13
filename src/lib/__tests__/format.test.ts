import { describe, it, expect } from "vitest";
import {
  weekendWhen,
  holidaySearchUrl,
  dayLabel,
  timeLabel,
  durationLabel,
  daysUntil,
  dayBlocks,
  crossesMidnight,
  isNightHour,
  travelMinutes,
  holidayDate,
  dateWithMonth,
  stopsSummary,
} from "@/lib/format";

describe("dateWithMonth", () => {
  it("formats an ISO date or datetime as weekday day month", () => {
    expect(dateWithMonth("2026-08-08T21:05:00.000Z")).toBe("Sat 8 Aug");
    expect(dateWithMonth("2026-12-25")).toBe("Fri 25 Dec");
  });
  it("returns empty on bad input", () => {
    expect(dateWithMonth("nope")).toBe("");
  });
});

describe("stopsSummary", () => {
  it("summarizes direct and layover trips", () => {
    expect(stopsSummary(0, 0)).toBe("Direct");
    expect(stopsSummary(1, 1)).toBe("1 stop each way");
    expect(stopsSummary(2, 2)).toBe("2 stops each way");
    expect(stopsSummary(1, 0)).toBe("1 stop out, direct back");
    expect(stopsSummary(0, 2)).toBe("direct out, 2 stops back");
  });
});

describe("holidayDate", () => {
  it("formats a YYYY-MM-DD date as weekday day month", () => {
    expect(holidayDate("2026-12-25")).toBe("Fri 25 Dec");
    expect(holidayDate("2026-08-08")).toBe("Sat 8 Aug");
  });
  it("returns empty on bad input", () => {
    expect(holidayDate("nope")).toBe("");
  });
});

describe("daysUntil", () => {
  it("counts whole days from a reference date to the departure day", () => {
    const from = new Date(2026, 6, 15); // 15 Jul 2026
    expect(daysUntil("2026-08-08T21:05:00.000Z", from)).toBe(24);
    expect(daysUntil("2026-07-15T06:00:00.000Z", from)).toBe(0);
  });
  it("returns 0 on bad input", () => {
    expect(daysUntil("nope", new Date(2026, 6, 15))).toBe(0);
  });
});

describe("dayLabel", () => {
  it("formats weekday and day-of-month from local wall-clock", () => {
    expect(dayLabel("2026-08-08T21:05:00.000Z")).toBe("Sat 8");
    expect(dayLabel("2026-08-10T22:45:00.000Z")).toBe("Mon 10");
  });
  it("returns empty string on bad input", () => {
    expect(dayLabel("nope")).toBe("");
  });
});

describe("timeLabel", () => {
  it("reads the wall-clock HH:MM verbatim (no timezone shift)", () => {
    expect(timeLabel("2026-08-08T22:10:00.000Z")).toBe("22:10");
    expect(timeLabel("2026-08-08T07:05:00.000Z")).toBe("07:05");
  });
});

describe("durationLabel", () => {
  it("formats days/hours/minutes, dropping zero units", () => {
    expect(durationLabel(2915)).toBe("2d"); // 2d 0h 35m -> minutes dropped when days present
    expect(durationLabel(2945)).toBe("2d 1h");
    expect(durationLabel(1080)).toBe("18h");
    expect(durationLabel(45)).toBe("45m");
    expect(durationLabel(0)).toBe("0m");
  });
});

describe("dayBlocks", () => {
  it("models the stay with a usable-time gauge per day", () => {
    const cells = dayBlocks(
      "2026-08-08T08:20:00.000Z", // land Sat 08:20
      "2026-08-10T19:05:00.000Z"  // leave Mon 19:05
    );
    expect(cells).toHaveLength(3);
    expect(cells[0]).toMatchObject({ weekday: "Sat", day: 8, month: "Aug", isWeekend: true, role: "arrive" });
    expect(cells[0].fillStart).toBeCloseTo(8.3333 / 24, 3);
    expect(cells[0].fillEnd).toBe(1);
    expect(cells[1]).toMatchObject({ day: 9, role: "middle", fillStart: 0, fillEnd: 1 });
    expect(cells[2]).toMatchObject({ weekday: "Mon", day: 10, role: "leave", fillStart: 0 });
    expect(cells[2].fillEnd).toBeCloseTo(19.0833 / 24, 3);
  });

  it("shows sliver gauges for a red-eye stay", () => {
    const cells = dayBlocks(
      "2026-08-08T23:40:00.000Z", // land Sat 23:40
      "2026-08-10T06:00:00.000Z"  // leave Mon 06:00
    );
    expect(cells[0].fillStart).toBeCloseTo(23.6667 / 24, 3); // tiny usable slice
    expect(cells[2].fillEnd).toBeCloseTo(6 / 24, 3);
  });

  it("produces one solo cell for a same-day stay", () => {
    const cells = dayBlocks("2026-08-08T09:00:00.000Z", "2026-08-08T20:00:00.000Z");
    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ role: "solo" });
    expect(cells[0].fillStart).toBeCloseTo(9 / 24, 3);
    expect(cells[0].fillEnd).toBeCloseTo(20 / 24, 3);
  });

  it("returns empty on bad input", () => {
    expect(dayBlocks("x", "y")).toEqual([]);
  });
});

describe("crossesMidnight", () => {
  it("is true when arrival is on a later calendar day", () => {
    expect(crossesMidnight("2026-08-08T23:30:00.000Z", "2026-08-09T01:00:00.000Z")).toBe(true);
    expect(crossesMidnight("2026-08-08T21:05:00.000Z", "2026-08-08T22:10:00.000Z")).toBe(false);
  });
});

describe("isNightHour", () => {
  it("flags late-night and early-morning local hours", () => {
    expect(isNightHour("2026-08-08T23:40:00.000Z")).toBe(true);
    expect(isNightHour("2026-08-08T06:00:00.000Z")).toBe(true);
    expect(isNightHour("2026-08-08T08:20:00.000Z")).toBe(false);
    expect(isNightHour("2026-08-08T19:05:00.000Z")).toBe(false);
  });
});

describe("travelMinutes", () => {
  it("sums outbound and return flight durations", () => {
    expect(
      travelMinutes(
        "2026-08-08T21:05:00.000Z",
        "2026-08-08T22:10:00.000Z",
        "2026-08-10T18:00:00.000Z",
        "2026-08-10T19:35:00.000Z"
      )
    ).toBe(160);
  });
});

describe("holidaySearchUrl", () => {
  it("searches the holiday, the city and the year", () => {
    const url = holidaySearchUrl("World Children's Day", "Dortmund", "2026-11-20");
    const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
    expect(q).toBe("World Children's Day Dortmund 20 November 2026");
  });

  it("escapes characters that would break the query", () => {
    // Apostrophes and ampersands are common in holiday names.
    const url = holidaySearchUrl("St Andrew's Day & Fair", "Glasgow", "2026-11-30");
    expect(url).not.toContain(" ");
    expect(url).not.toContain("&q");
    const q = new URL(url).searchParams.get("q");
    expect(q).toContain("St Andrew's Day & Fair");
  });

  it("still builds a usable search when the date is malformed", () => {
    const q = new URL(holidaySearchUrl("Ferragosto", "Ibiza", "nope")).searchParams.get("q");
    expect(q).toBe("Ferragosto Ibiza");
  });
});

describe("weekendWhen", () => {
  // Fixed clock: the label is relative, so a real `new Date()` would make
  // these pass in August and fail in October.
  const now = new Date("2026-08-13T12:00:00.000Z"); // a Thursday

  it("counts in weekends, not days, and anchors on Saturday", () => {
    // Wed-Sun look forward, so Thu 13 Aug belongs to the Sat 15 weekend.
    expect(weekendWhen("2026-08-14T18:00:00.000Z", now)).toBe("This weekend");
    expect(weekendWhen("2026-08-21T18:00:00.000Z", now)).toBe("Next weekend");
    expect(weekendWhen("2026-08-28T18:00:00.000Z", now)).toBe("In 2 weeks");
  });

  it("degrades to a fuzzy month bucket past six weeks", () => {
    // "In 24 weeks" means nothing to anyone; a third-of-month does.
    expect(weekendWhen("2026-11-20T21:25:00.000Z", now)).toBe("Late November");
    expect(weekendWhen("2026-11-06T21:25:00.000Z", now)).toBe("Early November");
    expect(weekendWhen("2026-11-13T21:25:00.000Z", now)).toBe("Mid November");
  });

  // The reason the anchor is Saturday: it is the only day of a weekend that
  // always sits in one month, so a trip straddling a month boundary has one
  // home rather than two.
  it("gives a month-straddling weekend a single home", () => {
    // Fri 30 Oct and Sun 1 Nov are the same weekend — Sat 31 Oct.
    expect(weekendWhen("2026-10-30T08:40:00.000Z", now)).toBe("Late October");
    expect(weekendWhen("2026-11-01T08:40:00.000Z", now)).toBe("Late October");
  });

  // The bug this whole change came out of: a 21:25 departure landing at 00:10
  // is a Friday trip. The caller must pass outDepart.
  it("dates an overnight departure by the day you leave", () => {
    expect(weekendWhen("2026-11-06T21:25:00.000Z", now)).toBe("Early November");
    expect(weekendWhen("2026-11-07T00:10:00.000Z", now)).toBe("Early November");
  });
});
