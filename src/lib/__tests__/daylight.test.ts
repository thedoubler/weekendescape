import { describe, it, expect } from "vitest";
import { sunTimes, clockLabel, daylightNote } from "@/lib/daylight";

// [lat, lon]
const LONDON: [number, number] = [51.5, -0.13];
const BARCELONA: [number, number] = [41.39, 2.17];
const TROMSO: [number, number] = [69.65, 18.96];

describe("sunTimes", () => {
  it("matches published times for London in midwinter", () => {
    // 21 Dec 2026, GMT (offset 0): sunrise ~08:04, sunset ~15:53.
    const t = sunTimes(LONDON[0], LONDON[1], "2026-12-21", 0)!;
    expect(clockLabel(t.sunriseMin!)).toMatch(/^08:0/);
    expect(clockLabel(t.sunsetMin!)).toMatch(/^15:5/);
    expect(t.daylightMin).toBeGreaterThan(7 * 60);
    expect(t.daylightMin).toBeLessThan(8 * 60);
  });

  it("matches published times for Barcelona in midsummer", () => {
    // 21 Jun 2026, CEST (offset +120): sunrise ~06:18, sunset ~21:29.
    const t = sunTimes(BARCELONA[0], BARCELONA[1], "2026-06-21", 120)!;
    expect(clockLabel(t.sunriseMin!)).toMatch(/^06:1/);
    expect(clockLabel(t.sunsetMin!)).toMatch(/^21:2/);
  });

  it("reports polar night and midnight sun rather than NaN", () => {
    // Tromsø: these are real destinations, and the naive maths would emit NaN
    // on exactly the places where daylight matters most.
    expect(sunTimes(TROMSO[0], TROMSO[1], "2026-12-21", 60)!.polar).toBe("polar-night");
    expect(sunTimes(TROMSO[0], TROMSO[1], "2026-06-21", 120)!.polar).toBe("midnight-sun");
  });

  it("uses the offset it is given, not the runtime's", () => {
    // The panel is a client component; a reader in another zone must still get
    // destination-local times.
    const utc = sunTimes(BARCELONA[0], BARCELONA[1], "2026-06-21", 0)!;
    const cest = sunTimes(BARCELONA[0], BARCELONA[1], "2026-06-21", 120)!;
    expect(cest.sunsetMin! - utc.sunsetMin!).toBeCloseTo(120, 0);
  });

  it("returns null for malformed input", () => {
    expect(sunTimes(51.5, -0.13, "nope", 0)).toBeNull();
    expect(sunTimes(NaN, -0.13, "2026-12-21", 0)).toBeNull();
  });
});

describe("daylightNote", () => {
  it("says nothing on a long summer day", () => {
    // A line that appears on every card is a constant, not a signal.
    expect(daylightNote(BARCELONA, "2026-06-21T14:00", 120)).toBeNull();
  });

  it("stays silent on a late summer arrival — that costs you nothing", () => {
    // Landing after sunset in June is normal and irrelevant; firing on arrival
    // alone lit up 61% of a real board. The day must be short too.
    expect(daylightNote(BARCELONA, "2026-06-21T22:00", 120)).toBeNull();
  });

  it("warns when you land after sunset", () => {
    const n = daylightNote(LONDON, "2026-12-21T17:30", 0)!;
    expect(n).toMatch(/land after sunset/i);
    expect(n).toMatch(/sunrise 08:0/);
  });

  it("counts the daylight left when the landing is tight", () => {
    const n = daylightNote(LONDON, "2026-12-21T14:00", 0)!;
    expect(n).toMatch(/daylight after you land/i);
    expect(n).toMatch(/sunset 15:5/);
  });

  it("never says '0h of daylight' — a dusk landing gets the sunset copy", () => {
    // Landing ~20 minutes before a 15:53 sunset used to round to "About 0h
    // of daylight after you land" (reported live). True astronomy, broken
    // sentence: under an hour it borrows the after-sunset shape instead.
    const n = daylightNote(LONDON, "2026-12-21T15:30", 0)!;
    expect(n).not.toMatch(/0h/);
    expect(n).toMatch(/land at sunset/i);
    expect(n).toMatch(/sunrise 08:0/);
  });

  it("stays silent on a short day you land early into", () => {
    // The winter day is short either way — that's the season, not this flight.
    // Only what the ARRIVAL costs you is worth a row.
    expect(daylightNote(LONDON, "2026-12-21T09:00", 0)).toBeNull();
  });

  it("never claims darkness, only sunset", () => {
    // Civil twilight runs well past sunset — "dark" would overstate a fact we
    // can state exactly.
    const notes = [
      daylightNote(LONDON, "2026-12-21T17:30", 0),
      daylightNote(LONDON, "2026-12-21T14:00", 0),
    ];
    for (const n of notes) expect(n).not.toMatch(/\bdark\b/);
  });

  it("has its own copy for polar cases", () => {
    expect(daylightNote(TROMSO, "2026-12-21T12:00", 60)).toMatch(/Polar night/);
    expect(daylightNote(TROMSO, "2026-06-21T12:00", 120)).toMatch(/Midnight sun/);
  });

  it("stays silent without coordinates", () => {
    expect(daylightNote(null, "2026-12-21T17:30", 0)).toBeNull();
  });
});
