export interface HolidayRef {
  date: string;
  name: string;
}

export interface Deal {
  cityTo: string;
  countryTo: string;
  flag: string;
  flyFrom: string;
  flyTo: string;
  countryFromCode: string;
  countryToCode: string;
  outDepart: string;
  outArrive: string;
  backDepart: string;
  backArrive: string;
  stayMinutes: number;
  nights: number;
  price: number;
  currency: string;
  deepLink: string;
  ptoDays?: number;
  homeHoliday?: HolidayRef | null;
  destHoliday?: HolidayRef | null;
}

export function flagEmoji(countryCode: string): string {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const A = 0x1f1e6;
  const base = "A".charCodeAt(0);
  const upper = countryCode.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "🏳️";
  return Array.from(upper)
    .map((c) => String.fromCodePoint(A + c.charCodeAt(0) - base))
    .join("");
}

interface RouteLeg {
  local_departure?: string;
  local_arrival?: string;
  return?: number;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function isoOrNull(iso: string | undefined): string | null {
  return iso && typeof iso === "string" && ISO_RE.test(iso) ? iso : null;
}

function naiveMinutes(iso: string): number {
  const m = ISO_RE.exec(iso)!;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60000;
}

export function normalizeDeals(raw: unknown, currency: string): Deal[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as any).data)
      ? ((raw as any).data as any[])
      : [];

  const deals: Deal[] = [];
  for (const item of data) {
    const route: RouteLeg[] = Array.isArray(item?.route) ? item.route : [];
    const outLeg = route.find((l) => l?.return === 0) ?? route[0];
    const backLeg = route.find((l) => l?.return === 1);

    const outDepart = isoOrNull(outLeg?.local_departure);
    const outArrive = isoOrNull(outLeg?.local_arrival);
    const backDepart = isoOrNull(backLeg?.local_departure);
    const backArrive = isoOrNull(backLeg?.local_arrival);

    const cityTo = item?.cityTo;
    const price = item?.price;
    const deepLink = item?.deep_link;
    const flyFrom = item?.flyFrom;
    const flyTo = item?.flyTo;

    if (
      !cityTo ||
      typeof price !== "number" ||
      !deepLink ||
      !flyFrom ||
      !flyTo ||
      !outDepart ||
      !outArrive ||
      !backDepart ||
      !backArrive
    ) {
      continue;
    }

    deals.push({
      cityTo,
      countryTo: item?.countryTo?.name ?? "",
      flag: flagEmoji(item?.countryTo?.code ?? ""),
      flyFrom,
      flyTo,
      countryFromCode: item?.countryFrom?.code ?? "",
      countryToCode: item?.countryTo?.code ?? "",
      outDepart,
      outArrive,
      backDepart,
      backArrive,
      stayMinutes: naiveMinutes(backDepart) - naiveMinutes(outArrive),
      nights: typeof item?.nightsInDest === "number" ? item.nightsInDest : 0,
      price,
      currency,
      deepLink,
    });
  }

  return deals.sort((a, b) => a.price - b.price);
}
