import { describe, it, expect } from "vitest";
import { computeBridges } from "@/lib/bridges";
import type { Holiday } from "@/lib/holidays";

const ms = (d: string) => Date.parse(`${d}T00:00:00.000Z`);

describe("computeBridges", () => {
  const start = ms("2026-08-01");
  const end = ms("2026-12-01");

  it("bridges a Tuesday holiday into a Fri/Sat → Tue long weekend", () => {
    // 2026-08-18 is a Tuesday.
    const hols: Holiday[] = [{ date: "2026-08-18", name: "Test Tue" }];
    const [b] = computeBridges(hols, start, end);
    expect(b.kind).toBe("tue");
    // depart Fri 14 or Sat 15, return Tue (day 2)
    expect(b.dateFrom).toBe("14/08/2026");
    expect(b.dateTo).toBe("15/08/2026");
    expect(b.flyDays).toEqual([5, 6]);
    expect(b.retFlyDays).toEqual([2]);
    expect(b.nightsFrom).toBe(3);
    expect(b.nightsTo).toBe(4);
  });

  it("bridges a Thursday holiday into a Wed/Thu → Sun long weekend", () => {
    // 2026-08-20 is a Thursday.
    const hols: Holiday[] = [{ date: "2026-08-20", name: "Test Thu" }];
    const [b] = computeBridges(hols, start, end);
    expect(b.kind).toBe("thu");
    expect(b.dateFrom).toBe("19/08/2026"); // Wed
    expect(b.dateTo).toBe("20/08/2026"); // Thu
    expect(b.flyDays).toEqual([3, 4]);
    expect(b.retFlyDays).toEqual([0]);
  });

  it("bridges a Wednesday holiday into a Wed → Sun long break (2 days off)", () => {
    // 2026-08-19 is a Wednesday.
    const hols: Holiday[] = [{ date: "2026-08-19", name: "Test Wed" }];
    const [b] = computeBridges(hols, start, end);
    expect(b.kind).toBe("wed");
    expect(b.dateFrom).toBe("19/08/2026"); // Wed
    expect(b.dateTo).toBe("19/08/2026"); // Wed
    expect(b.flyDays).toEqual([3]);
    expect(b.retFlyDays).toEqual([0]);
  });

  it("ignores Mon/Fri/weekend holidays (no extra window needed)", () => {
    const hols: Holiday[] = [
      { date: "2026-08-17", name: "Mon" },
      { date: "2026-08-21", name: "Fri" },
      { date: "2026-08-22", name: "Sat" },
    ];
    expect(computeBridges(hols, start, end)).toHaveLength(0);
  });

  it("drops holidays outside the window and respects the limit", () => {
    const hols: Holiday[] = [
      { date: "2026-07-14", name: "Before window (Tue)" },
      { date: "2026-08-18", name: "Tue A" },
      { date: "2026-09-15", name: "Tue B" },
      { date: "2026-10-20", name: "Tue C" },
      { date: "2026-11-17", name: "Tue D" },
    ];
    const out = computeBridges(hols, start, end, 2);
    expect(out).toHaveLength(2);
    expect(out.map((b) => b.holiday.name)).toEqual(["Tue A", "Tue B"]);
  });
});
