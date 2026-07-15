import { describe, it, expect } from "vitest";
import { weekendStyleToParams } from "@/lib/weekend";

describe("weekendStyleToParams", () => {
  it("maps strict to Sat out / Sun back, 1 night", () => {
    expect(weekendStyleToParams("strict")).toEqual({
      flyDays: [6],
      retFlyDays: [0],
      nightsFrom: 1,
      nightsTo: 1,
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

  it("throws on unknown style", () => {
    // @ts-expect-error testing invalid input
    expect(() => weekendStyleToParams("bogus")).toThrow();
  });
});
