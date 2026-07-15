export interface DayCell {
  weekday: string;
  day: number;
  month: string;
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

export function holidayDate(dateStr: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return "";
  const wd = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${WD[wd]} ${+m[3]} ${MO[+m[2] - 1]}`;
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

export interface Verdict {
  label: string;
  tier: "great" | "fair" | "poor";
}

function naiveMin(iso: string): number {
  const p = parts(iso);
  return p ? Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi) / 60000 : 0;
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

export function valueVerdict(stayMinutes: number, travelMin: number): Verdict {
  if (travelMin <= 0) return { label: "Great value", tier: "great" };
  const ratio = stayMinutes / travelMin;
  if (ratio >= 5) return { label: "Great value", tier: "great" };
  if (ratio >= 2) return { label: "Fair trade-off", tier: "fair" };
  return { label: "Long trip, short stay", tier: "poor" };
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
      isWeekend: wd === 0 || wd === 6,
      role,
      fillStart,
      fillEnd,
    });
  }
  return cells;
}
