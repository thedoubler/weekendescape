import { describe, it, expect } from "vitest";
import { dayLabel, timeLabel, durationLabel, dayBlocks } from "@/lib/format";

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
  it("builds one cell per day, accents the weekend, tags depart/return", () => {
    const cells = dayBlocks(
      "2026-08-08T21:05:00.000Z",
      "2026-08-10T23:45:00.000Z"
    );
    expect(cells).toEqual([
      { weekday: "Sat", day: 8, isWeekend: true, role: "depart" },
      { weekday: "Sun", day: 9, isWeekend: true, role: "middle" },
      { weekday: "Mon", day: 10, isWeekend: false, role: "return" },
    ]);
  });
  it("returns empty on bad input", () => {
    expect(dayBlocks("x", "y")).toEqual([]);
  });
});
