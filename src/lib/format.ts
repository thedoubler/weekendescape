export interface DayCell {
  weekday: string;
  day: number;
  month: string;
  isWeekend: boolean;
  role: "depart" | "return" | "middle";
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

export function dayBlocks(outDepart: string, backArrive: string): DayCell[] {
  const a = parts(outDepart);
  const b = parts(backArrive);
  if (!a || !b) return [];
  const DAY = 86400000;
  const start = Date.UTC(a.y, a.mo - 1, a.d);
  const end = Date.UTC(b.y, b.mo - 1, b.d);
  const n = Math.round((end - start) / DAY);
  if (n < 0 || n > 30) return [];
  const cells: DayCell[] = [];
  for (let i = 0; i <= n; i++) {
    const dt = new Date(start + i * DAY);
    const wd = dt.getUTCDay();
    cells.push({
      weekday: WD[wd],
      day: dt.getUTCDate(),
      month: MO[dt.getUTCMonth()],
      isWeekend: wd === 0 || wd === 6,
      role: i === 0 ? "depart" : i === n ? "return" : "middle",
    });
  }
  return cells;
}
