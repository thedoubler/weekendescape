export interface Holiday {
  date: string;
  name: string;
}

export interface DealHolidayInfo {
  ptoDays: number;
  homeHoliday: Holiday | null;
  destHoliday: Holiday | null;
}

export async function fetchHolidays(
  countryCode: string,
  year: number
): Promise<Holiday[]> {
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/${countryCode.toUpperCase()}`,
      { next: { revalidate: 86400 } } as RequestInit
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    return data
      .map((h: { date?: string; localName?: string; name?: string }) => ({
        date: h.date ?? "",
        name: h.name || h.localName || "",
      }))
      .filter((h: Holiday) => /^\d{4}-\d{2}-\d{2}$/.test(h.date));
  } catch {
    return [];
  }
}

function allDates(outArrive: string, backDepart: string): string[] {
  const a = outArrive.slice(0, 10);
  const b = backDepart.slice(0, 10);
  const pa = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a);
  const pb = /^(\d{4})-(\d{2})-(\d{2})$/.exec(b);
  if (!pa || !pb) return [];
  const DAY = 86400000;
  const start = Date.UTC(+pa[1], +pa[2] - 1, +pa[3]);
  const end = Date.UTC(+pb[1], +pb[2] - 1, +pb[3]);
  if (end < start || (end - start) / DAY > 30) return [];
  const out: string[] = [];
  for (let t = start; t <= end; t += DAY) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
}

export function tripWorkdays(outArrive: string, backDepart: string): string[] {
  return allDates(outArrive, backDepart).filter((d) => {
    const wd = new Date(`${d}T00:00:00.000Z`).getUTCDay();
    return wd >= 1 && wd <= 5;
  });
}

export function annotate(
  outArrive: string,
  backDepart: string,
  homeHolidays: Holiday[],
  destHolidays: Holiday[]
): DealHolidayInfo {
  const workdays = tripWorkdays(outArrive, backDepart);
  const homeByDate = new Map(homeHolidays.map((h) => [h.date, h]));
  const ptoDays = workdays.filter((d) => !homeByDate.has(d)).length;
  const homeHoliday =
    workdays.map((d) => homeByDate.get(d)).find(Boolean) ?? null;

  const span = allDates(outArrive, backDepart);
  const destByDate = new Map(destHolidays.map((h) => [h.date, h]));
  const destHoliday = span.map((d) => destByDate.get(d)).find(Boolean) ?? null;

  return { ptoDays, homeHoliday, destHoliday };
}
