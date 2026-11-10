import { describe, it, expect } from "vitest";
import {
  weekendStyleToParams,
  matchesWeekendShape,
  WEEKEND_SHAPE,
  type WeekendStyle,
} from "@/lib/weekend";

describe("weekendStyleToParams", () => {
  it("maps strict to Fri out / Sun back, 1-2 nights", () => {
    expect(weekendStyleToParams("strict")).toEqual({
      flyDays: [5],
      retFlyDays: [0],
      nightsFrom: 1,
      nightsTo: 2,
    });
  });

  it("maps frimon to Fri/Sat out, Sun/Mon back, 1-3 nights", () => {
    expect(weekendStyleToParams("frimon")).toEqual({
      flyDays: [5, 6],
      retFlyDays: [0, 1],
      nightsFrom: 1,
      nightsTo: 3,
    });
  });

  it("maps loose to Thu/Fri/Sat out, Sun/Mon back, 1-4 nights", () => {
    expect(weekendStyleToParams("loose")).toEqual({
      flyDays: [4, 5, 6],
      retFlyDays: [0, 1],
      nightsFrom: 1,
      nightsTo: 4,
    });
  });

  // Sat–Sun is the only shape shorter than Fri–Sun, for someone who cannot
  // get away on Friday evening at all. Friday is still a valid HOME departure:
  // a late Friday flight that lands after midnight starts its trip Saturday.
  it("maps satsun to Fri/Sat out, Sun back, 1-2 nights", () => {
    expect(weekendStyleToParams("satsun")).toEqual({
      flyDays: [5, 6],
      retFlyDays: [0],
      nightsFrom: 1,
      nightsTo: 2,
    });
  });

  // Thu–Sun costs the same single day of leave as Fri–Mon, taken at the other
  // end of the weekend.
  it("maps thusun to Wed/Thu out, Sun back, 2-4 nights", () => {
    expect(weekendStyleToParams("thusun")).toEqual({
      flyDays: [3, 4],
      retFlyDays: [0],
      nightsFrom: 2,
      nightsTo: 4,
    });
  });

  it("has params for every shape the table names", () => {
    for (const style of Object.keys(WEEKEND_SHAPE) as WeekendStyle[]) {
      expect(() => weekendStyleToParams(style)).not.toThrow();
    }
  });

  it("throws on unknown style", () => {
    // @ts-expect-error testing invalid input
    expect(() => weekendStyleToParams("bogus")).toThrow();
  });
});

describe("matchesWeekendShape", () => {
  it("matches Thu–Sun on arrival Thursday and departure Sunday", () => {
    // Arrive Thu 2027-04-29, leave Sun 2027-05-02 → exact Thu–Sun.
    expect(
      matchesWeekendShape(
        "2027-04-29T10:15:00.000Z",
        "2027-05-02T19:40:00.000Z",
        "thusun"
      )
    ).toBe(true);
    // Same trip is NOT exact Thu–Mon: it comes home a day early.
    expect(
      matchesWeekendShape(
        "2027-04-29T10:15:00.000Z",
        "2027-05-02T19:40:00.000Z",
        "loose"
      )
    ).toBe(false);
  });

  it("matches Sat–Sun on a single night", () => {
    expect(
      matchesWeekendShape(
        "2027-03-06T09:00:00.000Z",
        "2027-03-07T20:15:00.000Z",
        "satsun"
      )
    ).toBe(true);
    // A Friday arrival is Fri–Sun, not Sat–Sun, however short the stay.
    expect(
      matchesWeekendShape(
        "2027-03-05T22:00:00.000Z",
        "2027-03-07T20:15:00.000Z",
        "satsun"
      )
    ).toBe(false);
  });


  it("matches on arrival/leave days at the destination (frimon = Fri→Mon)", () => {
    // Arrive Fri 2026-09-04, leave Mon 2026-09-07 → exact Fri–Mon.
    expect(
      matchesWeekendShape(
        "2026-09-04T09:05:00.000Z",
        "2026-09-07T09:40:00.000Z",
        "frimon"
      )
    ).toBe(true);
    // Sat→Mon is NOT exact Fri–Mon.
    expect(
      matchesWeekendShape(
        "2026-09-12T14:40:00.000Z",
        "2026-09-14T18:45:00.000Z",
        "frimon"
      )
    ).toBe(false);
  });

  it("classifies a red-eye by arrival at the destination, not home departure", () => {
    // Departs home Fri night but ARRIVES Sat 01:35 → the trip starts Saturday,
    // so it's Sat–Mon, a close match, not exact Fri–Mon.
    expect(
      matchesWeekendShape(
        "2026-09-12T01:35:00.000Z", // arrival = Saturday
        "2026-09-14T18:45:00.000Z",
        "frimon"
      )
    ).toBe(false);
  });

  it("strict = Fri→Sun, loose = Thu→Mon", () => {
    expect(
      matchesWeekendShape(
        "2026-09-04T10:00:00.000Z",
        "2026-09-06T10:00:00.000Z",
        "strict"
      )
    ).toBe(true);
    expect(
      matchesWeekendShape(
        "2026-09-03T10:00:00.000Z",
        "2026-09-07T10:00:00.000Z",
        "loose"
      )
    ).toBe(true);
  });
});
