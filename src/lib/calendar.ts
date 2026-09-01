import type { Deal } from "@/lib/deals";

// The board arranged by WHEN instead of by price. Every result is anchored to a
// weekend, so a month grid can answer "where can I go, and when" in one glance
// — which the list can only answer one row at a time.

const DAY = 86400000;
const MO_FULL = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function utcOf(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

function isoOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

// The Saturday of the weekend a date belongs to — the same anchor `weekendWhen`
// uses, and for the same reason: Saturday is the only day of a weekend that
// always lies in one month, so a Fri 30 Oct – Sun 1 Nov trip has one home
// rather than two. Mon/Tue look back at the weekend just gone; Wed–Sun forward.
export function weekendKey(iso: string): string {
  const ms = utcOf(iso);
  if (ms === null) return "";
  const wd = new Date(ms).getUTCDay(); // 0 Sun … 6 Sat
  return isoOf(ms + [-1, -2, -3, 3, 2, 1, 0][wd] * DAY);
}

/** Deals grouped by the weekend they depart on, cheapest first within each. */
export function dealsByWeekend(deals: Deal[]): Map<string, Deal[]> {
  const out = new Map<string, Deal[]>();
  for (const d of deals) {
    const k = weekendKey(d.outDepart);
    if (!k) continue;
    const list = out.get(k);
    if (list) list.push(d);
    else out.set(k, [d]);
  }
  for (const list of out.values()) list.sort((a, b) => a.price - b.price);
  return out;
}

/**
 * Is this day one a trip actually occupies? `weekendKey` maps EVERY weekday to
 * a weekend — that is what makes it useful for grouping — so using it alone to
 * decide what to tint lit all seven days of any week whose weekend had a
 * flight. Only Fri/Sat/Sun are days you are away.
 */
export function isTripDay(iso: string): boolean {
  const ms = utcOf(iso);
  if (ms === null) return false;
  const wd = new Date(ms).getUTCDay();
  return wd === 5 || wd === 6 || wd === 0;
}

export interface CalendarDay {
  /** ISO date, or "" for the blank leading/trailing pad cells. */
  date: string;
  day: number;
  /** The weekend this day belongs to, so a whole Fri–Sun run lights together. */
  weekend: string;
}

export interface CalendarMonth {
  key: string;
  title: string;
  /** Always 7 wide. Pad cells carry date "". */
  weeks: CalendarDay[][];
  /** False for a month inside the span that has no flights at all. */
  hasDeals: boolean;
}

/**
 * One grid per month across the SEARCHED WINDOW, Monday-first — which is what
 * puts Sat and Sun adjacent at the end of every row, so a weekend never breaks
 * across two lines.
 *
 * Every month the search covered is emitted, empty ones included. This has been
 * wrong twice, in opposite directions. First it emitted only months that had
 * deals, so December vanished between November and January and read as a bug.
 * Then it spanned first-deal-month to last-deal-month, on the theory that "a
 * sequence that ends reads as the end of the data" — and a user promptly asked
 * why a six-month search showed five months. A trailing gap reads as missing
 * exactly like a middle one does. The honest span is the window itself: if the
 * search covered February and found nothing, February appears and says so.
 *
 * The window's edge months count only if a full weekend fits: the range runs
 * from the first Saturday on or after `from` to the last Saturday on or before
 * `to`, because a window that touches March 1st did not meaningfully search
 * March, and "no weekend flights in March" would be a claim the search never
 * tested. Without a window (older callers, tests), deal months bound the span.
 */
export function calendarMonths(
  deals: Deal[],
  window?: { from: string; to: string }
): CalendarMonth[] {
  const present = new Set<string>();
  for (const d of deals) {
    const ms = utcOf(d.outDepart);
    if (ms !== null) present.add(isoOf(ms).slice(0, 7));
  }
  const sorted = [...present].sort();

  // Saturday on-or-after / on-or-before, because the Saturday is the weekend's
  // anchor (see weekendKey): a month is in the span iff a searchable weekend is.
  const satAfter = (iso: string): string | null => {
    const ms = utcOf(iso);
    if (ms === null) return null;
    const wd = new Date(ms).getUTCDay();
    return isoOf(ms + ((6 - wd + 7) % 7) * DAY).slice(0, 7);
  };
  const satBefore = (iso: string): string | null => {
    const ms = utcOf(iso);
    if (ms === null) return null;
    const wd = new Date(ms).getUTCDay();
    return isoOf(ms - ((wd - 6 + 7) % 7) * DAY).slice(0, 7);
  };

  let first: string | undefined = sorted[0];
  let last: string | undefined = sorted[sorted.length - 1];
  if (window) {
    const wFirst = satAfter(window.from);
    const wLast = satBefore(window.to);
    if (wFirst && (!first || wFirst < first)) first = wFirst;
    if (wLast && (!last || wLast > last)) last = wLast;
  }
  if (!first || !last) return [];

  const span: string[] = [];
  const [y0, m0] = first.split("-").map(Number);
  for (let i = 0; i < 240; i++) {
    const d = new Date(Date.UTC(y0, m0 - 1 + i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    span.push(key);
    if (key >= last) break;
  }
  return span
    .map((key) => {
      const [y, m] = key.split("-").map(Number);
      const first = Date.UTC(y, m - 1, 1);
      const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
      // Monday-first: JS gives 0=Sun, so Sunday needs 6 pad cells, not 0.
      const lead = (new Date(first).getUTCDay() + 6) % 7;
      const cells: CalendarDay[] = [];
      for (let i = 0; i < lead; i++) cells.push({ date: "", day: 0, weekend: "" });
      for (let d = 1; d <= days; d++) {
        const iso = isoOf(Date.UTC(y, m - 1, d));
        cells.push({ date: iso, day: d, weekend: weekendKey(iso) });
      }
      while (cells.length % 7) cells.push({ date: "", day: 0, weekend: "" });
      const weeks: CalendarDay[][] = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      return {
        key,
        title: `${MO_FULL[m - 1]} ${y}`,
        weeks,
        hasDeals: present.has(key),
      };
    });
}
