import type { Holiday } from "@/lib/holidays";

// A holiday-anchored "puente" search window — the long weekends the fixed
// Fri/Sat departure windows miss (Kiwi day-of-week: 0=Sun, 1=Mon, … 5=Fri, 6=Sat):
//   • Tuesday holiday   → fly Fri/Sat, return Tue (take Monday off)     — 1 day off
//   • Wednesday holiday → fly Wed, return Sun (take Thu + Fri off)      — 2 days off
//   • Thursday holiday  → fly Wed/Thu, return Sun (take Friday off)     — 1 day off
// Monday and Friday holidays already fall out of the normal search (they land on
// its Fri/Sat departure + Sun/Mon return), so we don't add windows for them.
export interface BridgeWindow {
  holiday: Holiday;
  kind: "tue" | "wed" | "thu";
  // Departure-date range (dd/mm/yyyy) fed to Kiwi's date_from / date_to.
  dateFrom: string;
  dateTo: string;
  flyDays: number[];
  retFlyDays: number[];
  nightsFrom: number;
  nightsTo: number;
}

const DAY = 86400000;

function parseISO(d: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : null;
}

function fmt(ms: number): string {
  const d = new Date(ms);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function computeBridges(
  homeHolidays: Holiday[],
  windowStartMs: number,
  windowEndMs: number,
  limit = 3
): BridgeWindow[] {
  const out: BridgeWindow[] = [];
  const seen = new Set<string>();
  const sorted = [...homeHolidays].sort((a, b) => a.date.localeCompare(b.date));

  for (const h of sorted) {
    const ms = parseISO(h.date);
    if (ms == null || ms < windowStartMs || ms > windowEndMs) continue;

    const dow = new Date(ms).getUTCDay();
    let win: BridgeWindow | null = null;

    if (dow === 2) {
      // Tuesday → depart Fri (ms-4) or Sat (ms-3), return Tue. 1 day off (Mon).
      const sat = ms - 3 * DAY;
      if (sat < windowStartMs) continue; // even the Saturday is in the past
      win = {
        holiday: h,
        kind: "tue",
        dateFrom: fmt(Math.max(ms - 4 * DAY, windowStartMs)),
        dateTo: fmt(sat),
        flyDays: [5, 6],
        retFlyDays: [2],
        nightsFrom: 3,
        nightsTo: 4,
      };
    } else if (dow === 3) {
      // Wednesday → depart Wed (ms), return Sun. 2 days off (Thu + Fri).
      if (ms < windowStartMs) continue;
      win = {
        holiday: h,
        kind: "wed",
        dateFrom: fmt(ms),
        dateTo: fmt(ms),
        flyDays: [3],
        retFlyDays: [0],
        nightsFrom: 3,
        nightsTo: 4,
      };
    } else if (dow === 4) {
      // Thursday → depart Wed (ms-1) or Thu (ms), return Sun. 1 day off (Fri).
      if (ms < windowStartMs) continue;
      win = {
        holiday: h,
        kind: "thu",
        dateFrom: fmt(Math.max(ms - 1 * DAY, windowStartMs)),
        dateTo: fmt(ms),
        flyDays: [3, 4],
        retFlyDays: [0],
        nightsFrom: 3,
        nightsTo: 4,
      };
    }

    if (!win) continue;
    const key = `${win.kind}:${win.dateFrom}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(win);
    if (out.length >= limit) break;
  }

  return out;
}
