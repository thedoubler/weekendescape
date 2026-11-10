// Ordered the way the control reads them: by how much leave they cost.
// satsun and strict cost none, frimon and thusun cost one day, loose costs
// two — and within each pair the Friday shape comes before the Thursday one,
// so the row groups by departure day as well as by price in leave.
export type WeekendStyle = "satsun" | "strict" | "frimon" | "thusun" | "loose";

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
  satsun: { label: "Sat–Sun", arriveDay: 6, leaveDay: 0 },
  strict: { label: "Fri–Sun", arriveDay: 5, leaveDay: 0 },
  frimon: { label: "Fri–Mon", arriveDay: 5, leaveDay: 1 },
  thusun: { label: "Thu–Sun", arriveDay: 4, leaveDay: 0 },
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
    // The only shape SHORTER than Fri–Sun, and the only one for someone who
    // cannot get away on Friday evening at all. Home departure allows Friday
    // too: a late Friday flight that lands after midnight still starts its
    // trip on Saturday, which is what the label names.
    case "satsun":
      return { flyDays: [5, 6], retFlyDays: [0], nightsFrom: 1, nightsTo: 2 };
    case "strict":
      return { flyDays: [5], retFlyDays: [0], nightsFrom: 1, nightsTo: 2 };
    case "frimon":
      return { flyDays: [5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 3 };
    // Thu–Sun costs the same one day of leave as Fri–Mon, taken at the other
    // end: the Friday off instead of the Monday. Three nights, home departure
    // Wed night or Thu, back on Sunday.
    case "thusun":
      return { flyDays: [3, 4], retFlyDays: [0], nightsFrom: 2, nightsTo: 4 };
    case "loose":
      return { flyDays: [4, 5, 6], retFlyDays: [0, 1], nightsFrom: 1, nightsTo: 4 };
    default:
      throw new Error(`Unknown weekend style: ${style}`);
  }
}
