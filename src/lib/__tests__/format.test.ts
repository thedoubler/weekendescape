import { describe, it, expect } from "vitest";
import {
  dayLabel,
  timeLabel,
  durationLabel,
  daysUntil,
  dayBlocks,
  crossesMidnight,
  isNightHour,
  travelMinutes,
  valueVerdict,
  holidayDate,
} from "@/lib/format";

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

describe("valueVerdict", () => {
  it("rates a trip by its stay-to-travel ratio", () => {
    expect(valueVerdict(2880, 360).tier).toBe("great"); // 8:1
    expect(valueVerdict(1500, 600).tier).toBe("fair"); // 2.5:1
    expect(valueVerdict(480, 540).tier).toBe("poor"); // 0.9:1
    expect(valueVerdict(1000, 0).tier).toBe("great"); // guard
  });
});
