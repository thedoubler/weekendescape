export type WeekendStyle = "strict" | "frimon" | "loose";

export interface WeekendParams {
  flyDays: number[];
  retFlyDays: number[];
  nightsFrom: number;
  nightsTo: number;
}

// The canonical shape each preset *names*: the weekday you ARRIVE at the
// destination and the weekday you LEAVE it (0=Sun … 6=Sat) — i.e. the days the
// card actually shows ("Fri – Mon"), not the home departure/return flight days
// (a red-eye can leave home Friday night yet start the trip Saturday). The search
// casts a wider net for cheaper inventory, so results split into "exactly this
// shape" vs "close matches".
export const WEEKEND_SHAPE: Record<
  WeekendStyle,
  { label: string; arriveDay: number; leaveDay: number }
> = {
  strict: { label: "Fri–Sun", arriveDay: 5, leaveDay: 0 },
  frimon: { label: "Fri–Mon", arriveDay: 5, leaveDay: 1 },
  loose: { label: "Thu–Mon", arriveDay: 4, leaveDay: 1 },
};

// Weekday of an ISO datetime's date part, timezone-independent (Kiwi's local
// times carry a Z; we only care about the calendar day, not the offset).
function weekdayOf(iso: string): number {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).getUTCDay();
}

// Does the trip start/end at the destination on exactly the days the preset's
// label names? Uses arrival-at-destination and departure-from-destination so it
// matches the dates the card displays.
export function matchesWeekendShape(
  outArrive: string,
  backDepart: string,
  style: WeekendStyle
): boolean {
  const s = WEEKEND_SHAPE[style];
  return (
    weekdayOf(outArrive) === s.arriveDay && weekdayOf(backDepart) === s.leaveDay
  );
}

export function weekendStyleToParams(style: WeekendStyle): WeekendParams {
  switch (style) {
    case "strict":
      return { flyDays: [5], retFlyDays: [0], nightsFrom: 1, nightsTo: 2 };
    case "frimon":
      return { flyDays: [5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 3 };
    case "loose":
      return { flyDays: [4, 5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 4 };
    default:
      throw new Error(`Unknown weekend style: ${style}`);
  }
}
