export interface Holiday {
  date: string;
  name: string;
  // False when the holiday applies only to some regions. Nager marks these
  // `global: false` — for Spain that is 22 of 32 entries. Showing one as
  // "a public holiday in {city}" is simply false for most cities in the
  // country, so callers must hedge or suppress.
  national?: boolean;
  // The ISO-3166-2 regions a non-national holiday applies to, straight from
  // Nager's `counties` (e.g. Día de Andalucía → ["ES-AN"]). Absent on
  // national holidays. Lets the search include the home REGION's holidays
  // once the region is known — see inferHomeRegion in airport-region.ts.
  counties?: string[];
}

export interface DealHolidayInfo {
  ptoDays: number;
  // Workdays in the trip you'd have to book off (the "days off required").
  ptoDates: string[];
  // Every home public holiday that lands on a trip workday (a trip can span
  // more than one — e.g. St Andrew's Day + National Day). homeHoliday is the
  // first, kept for callers that only need one.
  homeHoliday: Holiday | null;
  homeHolidays: Holiday[];
  destHoliday: Holiday | null;
}

export async function fetchHolidays(
  countryCode: string,
  year: number,
  opts?: { nationalOnly?: boolean }
): Promise<Holiday[]> {
  try {
    const res = await fetch(
      `https://date.nager.at/api/v3/publicholidays/${year}/${encodeURIComponent(countryCode.toUpperCase())}`,
      { next: { revalidate: 86400 } } as RequestInit
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (!Array.isArray(data)) return [];
    const nationalOnly = opts?.nationalOnly ?? false;
    return data
      // nationalOnly keeps holidays every resident of the country has (Nager
      // marks these global: true). For "national plus the traveller's own
      // region" — the home-country case once the region is known — callers
      // fetch unfiltered and apply forRegion() below, so one fetch also
      // yields the list of regions that exist. Destinations pass no opts and
      // keep every official holiday, so "there's a public holiday there"
      // stays accurate.
      .filter((h: { global?: boolean }) => !nationalOnly || h.global !== false)
      .map(
        (h: {
          date?: string;
          localName?: string;
          name?: string;
          global?: boolean;
          counties?: string[] | null;
        }) => ({
          date: h.date ?? "",
          name: h.name || h.localName || "",
          national: h.global !== false,
          ...(h.global === false && Array.isArray(h.counties)
            ? { counties: h.counties }
            : {}),
        })
      )
      .filter((h: Holiday) => /^\d{4}-\d{2}-\d{2}$/.test(h.date));
  } catch {
    return [];
  }
}

/** National holidays plus the given region's — the honest home calendar once
 *  the traveller's region is known. A null region means national only, which
 *  is also the safe answer whenever inference declined to guess. */
export function forRegion(
  holidays: Holiday[],
  region: string | null
): Holiday[] {
  return holidays.filter(
    (h) =>
      h.national !== false ||
      (region !== null && (h.counties ?? []).includes(region))
  );
}

/** The distinct regions an unfiltered country calendar mentions — the option
 *  list for the region picker. Only regions that actually have holidays are
 *  worth offering; for everyone else the choice changes nothing. */
export function regionsIn(holidays: Holiday[]): string[] {
  const out = new Set<string>();
  for (const h of holidays)
    if (h.national === false) for (const c of h.counties ?? []) out.add(c);
  return [...out].sort();
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
  const ptoDates = workdays.filter((d) => !homeByDate.has(d));
  const homeHols = workdays
    .map((d) => homeByDate.get(d))
    .filter((h): h is Holiday => Boolean(h));
  const homeHoliday = homeHols[0] ?? null;

  const span = allDates(outArrive, backDepart);
  const destByDate = new Map(destHolidays.map((h) => [h.date, h]));
  const destHoliday = span.map((d) => destByDate.get(d)).find(Boolean) ?? null;

  return {
    ptoDays: ptoDates.length,
    ptoDates,
    homeHoliday,
    homeHolidays: homeHols,
    destHoliday,
  };
}
