import { describe, it, expect } from "vitest";
import { legSummary, isoDuration, type LegInput } from "@/lib/leg-summary";

function leg(over: Partial<LegInput> = {}): LegInput {
  return {
    label: "Out",
    depIso: "2026-10-02T06:30",
    arrIso: "2026-10-02T07:25",
    depCode: "CLJ",
    arrCode: "FMM",
    depCity: "Cluj",
    arrCity: "Memmingen",
    minutes: 115,
    stops: 0,
    layovers: [],
    plusOne: false,
    carriers: [{ code: "W6", name: "Wizz Air" }],
    ...over,
  };
}

describe("legSummary — meta run", () => {
  it("reads air time then stops for a direct flight", () => {
    expect(legSummary(leg()).meta).toBe("1h 55m · direct");
  });

  it("names the via airport and its wait for one stop", () => {
    const s = legSummary(
      leg({ stops: 1, minutes: 250, layovers: [{ at: "VIE", minutes: 80 }] })
    );
    expect(s.meta).toBe("4h 10m · 1 stop, VIE (1h 20m)");
  });

  it("keeps the via codes but drops per-layover times at two stops", () => {
    // Total elapsed is what says "this eats your Sunday"; individual gaps worth
    // worrying about are already surfaced as ⚑ flags.
    const s = legSummary(
      leg({
        stops: 2,
        minutes: 590,
        layovers: [
          { at: "VIE", minutes: 80 },
          { at: "BUD", minutes: 140 },
        ],
      })
    );
    expect(s.meta).toBe("9h 50m · 2 stops, VIE · BUD");
  });

  it("omits the date when it is already on the card three times over", () => {
    expect(legSummary(leg()).meta).not.toMatch(/Oct/);
  });

  it("spells the landing day when the return lands after midnight", () => {
    // The day strip stops at the outbound departure from the destination, so a
    // Sunday-night flight landing Monday is invisible until this line says so.
    const s = legSummary(
      leg({
        label: "Back",
        depIso: "2026-10-04T22:40",
        arrIso: "2026-10-05T01:30",
        minutes: 170,
        plusOne: true,
      })
    );
    expect(s.meta).toMatch(/home Mon 5 Oct/);
  });

  it("says 'lands' rather than 'home' for an overnight outbound", () => {
    const s = legSummary(
      leg({ arrIso: "2026-10-03T01:10", minutes: 400, plusOne: true })
    );
    expect(s.meta).toMatch(/lands Sat 3 Oct/);
    expect(s.meta).not.toMatch(/home/);
  });
});

describe("legSummary — spoken", () => {
  it("reads in decision order, using city names not IATA codes", () => {
    // Screen readers pronounce "CLJ" as a nonsense word.
    const s = legSummary(leg()).spoken;
    expect(s).toBe(
      "Outbound. Departs 06:30 from Cluj. Arrives 07:25 in Memmingen. 1h 55m, direct. With Wizz Air."
    );
  });

  it("never leaves a next-day arrival silent", () => {
    const s = legSummary(
      leg({ label: "Back", arrIso: "2026-10-05T01:30", plusOne: true })
    ).spoken;
    expect(s).toMatch(/the next day/);
  });

  it("falls back to the code when no city name is available", () => {
    expect(legSummary(leg({ depCity: "" })).spoken).toMatch(/from CLJ/);
  });

  it("describes stops for assistive tech too", () => {
    const s = legSummary(
      leg({ stops: 1, layovers: [{ at: "VIE", minutes: 80 }] })
    ).spoken;
    expect(s).toMatch(/1 stop in VIE, 1h 20m/);
  });
});

describe("isoDuration", () => {
  it("emits machine-readable durations", () => {
    expect(isoDuration(115)).toBe("PT1H55M");
    expect(isoDuration(120)).toBe("PT2H");
    expect(isoDuration(45)).toBe("PT45M");
    expect(isoDuration(0)).toBe("PT0M");
  });
});

describe("legSummary — per-leg carriers", () => {
  it("speaks the carrier for this direction only", () => {
    // The trip-level list said "Vueling, Wizz Air" without saying which flew
    // which — the exact question a two-airline bag warning raises.
    const out = legSummary(leg({ carriers: [{ code: "VY", name: "Vueling" }] }));
    const back = legSummary(
      leg({ label: "Back", carriers: [{ code: "W6", name: "Wizz Air" }] })
    );
    expect(out.spoken).toMatch(/With Vueling\.$/);
    expect(back.spoken).toMatch(/With Wizz Air\.$/);
  });

  it("keeps carriers out of the meta run — they render as logo plus name", () => {
    expect(legSummary(leg()).meta).not.toMatch(/Wizz/);
  });

  it("omits the mention entirely when no carrier is known", () => {
    const s = legSummary(leg({ carriers: [] }));
    expect(s.meta).toBe("1h 55m · direct");
    expect(s.spoken).not.toMatch(/With/);
  });
});

