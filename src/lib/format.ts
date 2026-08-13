export interface DayCell {
  weekday: string;
  day: number;
  month: string;
  // "YYYY-MM-DD" for this cell, so callers can match it against dated events
  // (e.g. a destination public holiday) without recomputing the calendar.
  date: string;
  isWeekend: boolean;
  role: "arrive" | "leave" | "middle" | "solo";
  fillStart: number;
  fillEnd: number;
}

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

interface Parts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
}

function parts(iso: string): Parts | null {
  const m = ISO_RE.exec(iso);
  if (!m) return null;
  return { y: +m[1], mo: +m[2], d: +m[3], h: +m[4], mi: +m[5] };
}

export function dayLabel(iso: string): string {
  const p = parts(iso);
  if (!p) return "";
  const wd = new Date(Date.UTC(p.y, p.mo - 1, p.d)).getUTCDay();
  return `${WD[wd]} ${p.d}`;
}

export function daysUntil(iso: string, from: Date): number {
  const p = parts(iso);
  if (!p) return 0;
  const target = Date.UTC(p.y, p.mo - 1, p.d);
  const base = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target - base) / 86400000);
}

export function stopsSummary(outStops: number, backStops: number): string {
  if (outStops === 0 && backStops === 0) return "Direct";
  if (outStops === backStops) {
    return `${outStops} stop${outStops > 1 ? "s" : ""} each way`;
  }
  const leg = (n: number, dir: string) =>
    n === 0 ? `direct ${dir}` : `${n} stop${n > 1 ? "s" : ""} ${dir}`;
  return `${leg(outStops, "out")}, ${leg(backStops, "back")}`;
}

// "Sat 3 Aug" from an ISO date or datetime string.
export function dateWithMonth(iso: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!p) return "";
  const wd = new Date(Date.UTC(+p[1], +p[2] - 1, +p[3])).getUTCDay();
  return `${WD[wd]} ${+p[3]} ${MO[+p[2] - 1]}`;
}

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

// "2026-09" — groups deals into calendar months.
export function monthKey(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? `${m[1]}-${m[2]}` : "";
}

// "September" — full month name for a section divider.
export function monthTitle(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? MO_FULL[+m[2] - 1] : "";
}

// "Sep" — short month name from a "YYYY-MM" (or ISO) string.
export function monthShort(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? MO[+m[2] - 1] : iso;
}

// "Fri 18 – Sun 20 Sep" (shared month shown once) or "Fri 30 Oct – Sun 1 Nov".
export function weekendRange(startIso: string, endIso: string): string {
  const a = /^(\d{4})-(\d{2})-(\d{2})/.exec(startIso);
  const b = /^(\d{4})-(\d{2})-(\d{2})/.exec(endIso);
  if (!a || !b) return "";
  const wdA = new Date(Date.UTC(+a[1], +a[2] - 1, +a[3])).getUTCDay();
  const wdB = new Date(Date.UTC(+b[1], +b[2] - 1, +b[3])).getUTCDay();
  const sameMonth = a[1] === b[1] && a[2] === b[2];
  const left = sameMonth
    ? `${WD[wdA]} ${+a[3]}`
    : `${WD[wdA]} ${+a[3]} ${MO[+a[2] - 1]}`;
  const right = `${WD[wdB]} ${+b[3]} ${MO[+b[2] - 1]}`;
  return `${left} – ${right}`;
}

export function holidayDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return "";
  const wd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${WD[wd]} ${+m[3]} ${MO[+m[2] - 1]}`;
}

// A Google search for a destination public holiday: what it is, where, and
// when. We deep-link out rather than trying to explain a local holiday
// ourselves — we have only its name, and "is anything open?" is exactly the
// question a search answers better than we could.
export function holidaySearchUrl(
  name: string,
  city: string,
  dateStr: string
): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  // Year included: these repeat annually, and a bare "20 Nov" would surface
  // whichever year the engine feels like.
  const when = m ? `${+m[3]} ${MO_FULL[+m[2] - 1]} ${m[1]}` : "";
  const q = [name, city, when].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function timeLabel(iso: string): string {
  const p = parts(iso);
  if (!p) return "";
  return `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`;
}

export function durationLabel(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "0m";
  const d = Math.floor(minutes / 1440);
  const h = Math.floor((minutes % 1440) / 60);
  const m = Math.round(minutes % 60);
  const out: string[] = [];
  if (d) out.push(`${d}d`);
  if (h) out.push(`${h}h`);
  if (m && !d) out.push(`${m}m`);
  return out.length ? out.join(" ") : "0m";
}

function hourFrac(p: { h: number; mi: number }): number {
  return (p.h + p.mi / 60) / 24;
}

export function crossesMidnight(depIso: string, arrIso: string): boolean {
  const d = parts(depIso);
  const a = parts(arrIso);
  if (!d || !a) return false;
  return Date.UTC(a.y, a.mo - 1, a.d) > Date.UTC(d.y, d.mo - 1, d.d);
}

export function isNightHour(iso: string): boolean {
  const p = parts(iso);
  if (!p) return false;
  return p.h >= 22 || p.h < 7;
}

function naiveMin(iso: string): number {
  const p = parts(iso);
  return p ? Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) / 60000 : 0;
}

// Air-time of a single leg (local wall-clock; spans a +1 day correctly).
export function legMinutes(depIso: string, arrIso: string): number {
  return naiveMin(arrIso) - naiveMin(depIso);
}

export function travelMinutes(
  outDepart: string,
  outArrive: string,
  backDepart: string,
  backArrive: string
): number {
  return (
    naiveMin(outArrive) -
    naiveMin(outDepart) +
    (naiveMin(backArrive) - naiveMin(backDepart))
  );
}

export function dayBlocks(outArrive: string, backDepart: string): DayCell[] {
  const a = parts(outArrive);
  const b = parts(backDepart);
  if (!a || !b) return [];
  const DAY = 86400000;
  const start = Date.UTC(a.y, a.mo - 1, a.d);
  const end = Date.UTC(b.y, b.mo - 1, b.d);
  const n = Math.round((end - start) / DAY);
  if (n < 0 || n > 30) return [];
  const aFrac = hourFrac(a);
  const bFrac = hourFrac(b);
  const cells: DayCell[] = [];
  for (let i = 0; i <= n; i++) {
    const dt = new Date(start + i * DAY);
    const wd = dt.getUTCDay();
    let role: DayCell["role"];
    let fillStart = 0;
    let fillEnd = 1;
    if (n === 0) {
      role = "solo";
      fillStart = aFrac;
      fillEnd = bFrac;
    } else if (i === 0) {
      role = "arrive";
      fillStart = aFrac;
      fillEnd = 1;
    } else if (i === n) {
      role = "leave";
      fillStart = 0;
      fillEnd = bFrac;
    } else {
      role = "middle";
    }
    cells.push({
      weekday: WD[wd],
      day: dt.getUTCDate(),
      month: MO[dt.getUTCMonth()],
      date: dt.toISOString().slice(0, 10),
      isWeekend: wd === 0 || wd === 6,
      role,
      fillStart,
      fillEnd,
    });
  }
  return cells;
}

// The Saturday of the weekend a date belongs to. Saturday is the anchor
// because it is the only day of a weekend that always lies in one month — a
// Fri 30 Oct – Sun 1 Nov trip has one unambiguous home, where a Friday or
// Sunday anchor gives two. Mon/Tue look back at the weekend just gone;
// Wed–Sun look forward.
function weekendSaturday(ms: number): number {
  const wd = new Date(ms).getUTCDay(); // 0 Sun … 6 Sat
  const off = [-1, -2, -3, 3, 2, 1, 0][wd];
  return ms + off * 86400000;
}

// "This weekend" / "In 5 weeks" / "Late November" — the coarse "when" the
// board is actually browsed by, for the collapsed card header. The exact dates
// stay in the day strip below it, beside the flight times that give them
// meaning.
//
// Takes outDepart, not outArrive: a 21:25 departure landing at 00:10 is a
// Friday trip, and the header called it Saturday on 21% of direct results.
//
// Beyond six weeks a week count stops meaning anything ("in 24 weeks"), so it
// degrades to a third-of-month bucket. That bucket is deliberately fuzzy: an
// ordinal ("3rd weekend of Nov") reads as precise and is off by one under 29%
// of the counting conventions a reader might apply — measured on the live
// board. "Late November" looks approximate, so it cannot mislead.
export function weekendWhen(outDepartIso: string, now: Date): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})/.exec(outDepartIso);
  if (!p) return "";
  const sat = weekendSaturday(Date.UTC(+p[1], +p[2] - 1, +p[3]));
  const here = weekendSaturday(
    Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  );
  const weeks = Math.round((sat - here) / (7 * 86400000));
  if (weeks <= 0) return "This weekend";
  if (weeks === 1) return "Next weekend";
  if (weeks <= 6) return `In ${weeks} weeks`;
  const d = new Date(sat);
  const day = d.getUTCDate();
  const part = day <= 10 ? "Early" : day <= 20 ? "Mid" : "Late";
  return `${part} ${MO_FULL[d.getUTCMonth()]}`;
}
