export interface HolidayRef {
  date: string;
  name: string;
}

export interface Layover {
  at: string;
  minutes: number;
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
  outStops: number;
  backStops: number;
  outLayovers: Layover[];
  backLayovers: Layover[];
  price: number;
  currency: string;
  bagPrice?: number | null;
  airlines?: string[];
  deepLink: string;
  ptoDays?: number;
  homeHoliday?: HolidayRef | null;
  destHoliday?: HolidayRef | null;
  // Straight-line km from the arrival airport to its marketed city centre.
  // Set server-side; flags secondary airports (e.g. Charleroi sold as Brussels).
  airportKmFromCity?: number | null;
  // Rough per-person round-trip CO₂ estimate (kg). Set server-side.
  co2Kg?: number | null;
}

// Under a full day at the destination — more travel than time there. Hidden by
// default in the UI (a toggle reveals them). Applies to any trip, so it still
// works when Direct is the default and there are no layovers.
export function isShortStay(deal: Deal): boolean {
  return deal.stayMinutes < 24 * 60;
}

// A "long weekend" / puente: a home public holiday lands on a workday of the
// trip, so it costs at most one day of PTO. Covers both a normal weekend that
// happens to contain a holiday and the holiday-anchored windows we search for.
export function isLongWeekend(deal: Deal): boolean {
  return (
    deal.homeHoliday != null &&
    typeof deal.ptoDays === "number" &&
    deal.ptoDays <= 1
  );
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
  flyTo?: string;
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

// Layover = gap between one segment's arrival and the next segment's departure.
function layoversOf(segs: RouteLeg[]): Layover[] {
  const out: Layover[] = [];
  for (let i = 0; i < segs.length - 1; i++) {
    const arr = segs[i].local_arrival;
    const dep = segs[i + 1].local_departure;
    const at = segs[i].flyTo;
    if (at && arr && dep && ISO_RE.test(arr) && ISO_RE.test(dep)) {
      out.push({ at, minutes: naiveMinutes(dep) - naiveMinutes(arr) });
    }
  }
  return out;
}

export function normalizeDeals(raw: unknown, currency: string): Deal[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as any).data)
      ? ((raw as any).data as any[])
      : [];

  const deals: Deal[] = [];
  for (const item of data) {
    const route: RouteLeg[] = Array.isArray(item?.route) ? item.route : [];
    const outSegs = route.filter((l) => l?.return === 0);
    const inSegs = route.filter((l) => l?.return === 1);
    const outFirst = outSegs[0];
    const outLast = outSegs[outSegs.length - 1];
    const inFirst = inSegs[0];
    const inLast = inSegs[inSegs.length - 1];

    // Departures are the first segment of each direction; arrivals are the LAST
    // segment (the final destination / home), not the first layover.
    const outDepart = isoOrNull(outFirst?.local_departure);
    const outArrive = isoOrNull(outLast?.local_arrival);
    const backDepart = isoOrNull(inFirst?.local_departure);
    const backArrive = isoOrNull(inLast?.local_arrival);

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
      outStops: Math.max(0, outSegs.length - 1),
      backStops: Math.max(0, inSegs.length - 1),
      outLayovers: layoversOf(outSegs),
      backLayovers: layoversOf(inSegs),
      price,
      currency,
      bagPrice:
        typeof item?.bags_price?.["1"] === "number"
          ? item.bags_price["1"]
          : null,
      airlines: Array.isArray(item?.airlines)
        ? item.airlines.filter((c: unknown): c is string => typeof c === "string")
        : [],
      deepLink,
    });
  }

  return deals.sort((a, b) => a.price - b.price);
}
