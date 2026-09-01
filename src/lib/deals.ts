export interface HolidayRef {
  date: string;
  name: string;
  // False for a regional holiday — the copy must not claim it applies to the
  // destination city. See the note in holidays.ts.
  national?: boolean;
}

export interface Layover {
  at: string;
  minutes: number;
}

export interface FlightSegment {
  from: string;
  to: string;
  /** IATA carrier code — the OPERATING one where Kiwi gives it. */
  carrier: string;
  flightNo: number;
  /** Departure date in the origin's local time, YYYY-MM-DD. */
  date: string;
}

export interface Deal {
  cityTo: string;
  // Departure city in words. Screen readers say IATA codes as nonsense words
  // ("CLJ" -> "clidge"), and with several home airports the origin needs naming.
  cityFrom: string;
  countryTo: string;
  flag: string;
  flyFrom: string;
  flyTo: string;
  countryFromCode: string;
  // Every flown segment, in order, out then back. Only what the Travel Impact
  // Model needs to identify a scheduled flight: it keys on carrier + number +
  // date + route, and will not answer without all four.
  segments: FlightSegment[];
  // The name, not just the code, so the UI can say WHOSE public holidays the
  // bridge search is built on — it uses the departure country's, and that was
  // nowhere on screen.
  countryFrom: string;
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
  // The trip's workdays you'd have to book off (empty when a holiday covers them).
  ptoDates?: string[];
  homeHoliday?: HolidayRef | null;
  // Every home public holiday landing on a trip workday (usually one).
  homeHolidays?: HolidayRef[];
  destHoliday?: HolidayRef | null;
  // The town the arrival airport is actually in, when that differs from the city
  // the deal is sold as (BGY is "Milan" but sits in Bergamo). Null when they
  // match — the card should stay silent rather than say "Girona, 12 km from
  // Girona". Set server-side.
  airportCity?: string | null;
  // Straight-line km from the arrival airport to its marketed city centre.
  // Set server-side; flags secondary airports (e.g. Charleroi sold as Brussels).
  airportKmFromCity?: number | null;
  // Rough per-person round-trip CO₂ estimate (kg). Set server-side.
  co2Kg?: number | null;
  // Meet-up mode only: one row per home airport, everyone landing on the same
  // weekend. When present, `price` is the TOTAL of these rows and the deal's
  // own itinerary fields describe the cheapest row's flight. Shape lives in
  // lib/meetup.ts, mirrored here so the client type needs no server import.
  meetup?: {
    flyFrom: string;
    cityFrom: string;
    price: number;
    currency: string;
    deepLink: string;
    outDepart: string;
    outArrive: string;
    backDepart: string;
  }[];
  // Gate-to-gate journey time for the direction, in minutes, from upstream's
  // `duration` field. VERIFIED against a live 1-stop itinerary: it INCLUDES
  // layovers (CLJ→LIS came back 375m gate-to-gate vs 315m of actual air time),
  // so do not describe it as air time. It is the right number to show for a
  // leg — total elapsed is what the traveller lives — but anything wanting
  // pure flying time must sum the segments' utc_departure/utc_arrival instead.
  //
  // Wall-clock subtraction of local departure/arrival is NOT a substitute:
  // across a time-zone change it is wrong by the offset (BCN 09:35 → LTN 10:55
  // is 2h20, but reads as 1h20). Null when upstream omits it.
  outDurationMin?: number | null;
  backDurationMin?: number | null;
  // Carriers per direction. `airlines` is trip-level and cannot say which
  // carrier flies which leg — which is exactly what a two-airline baggage
  // warning needs the reader to be able to check.
  outAirlines?: string[];
  backAirlines?: string[];
  // Kiwi's own self-transfer flag. We used to infer this from "2 carriers plus
  // a stop", which over-fired (two carriers on one ticket) and under-fired (one
  // carrier, two tickets). This is the fact.
  // Destination's UTC offset in minutes ON THIS TRIP'S DATES — derived from the
  // gap between the arrival's local and UTC stamps, so it is DST-correct by
  // construction. Needed to state destination-local sunrise/sunset: the panel is
  // a client component and the reader may be in another time zone entirely.
  destUtcOffsetMin?: number | null;
  selfTransfer?: boolean;
  // Airports where you must collect the bag and check it in again, per segment.
  bagRecheckAt?: string[];
  // Arrival *airport* coordinates as [lat, lon] — note this is the airport, not
  // the marketed city centre (see `airportKmFromCity`). Attached server-side on
  // purpose: the lookup table (`airports.json`, ~134 KB / 6k entries) must never
  // reach the browser, and this module is imported by client components. Keep it
  // that way — resolve coordinates in the route, never here.
  toCoords?: [number, number] | null;
}

// Stable DOM id for a card, so the map can scroll the list to a specific trip.
// Keyed on destination + outbound date: a destination can appear several times
// with different weekends, and they must not collide.
export function dealDomId(deal: Deal): string {
  return `deal-${deal.flyTo}-${deal.outDepart.slice(0, 10)}`;
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

// A bridge-day escape: a home holiday cuts the trip's PTO to two days or fewer
// (Mon/Fri = 0, Tue/Thu = 1, Wed = 2). Used to filter the "bridge days" search
// mode down to just the holiday-anchored trips.
export function isBridge(deal: Deal): boolean {
  return (
    deal.homeHoliday != null &&
    typeof deal.ptoDays === "number" &&
    deal.ptoDays <= 2
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
  flyFrom?: string;
  flight_no?: number | string;
  operating_flight_no?: number | string;
  local_departure?: string;
  local_arrival?: string;
  flyTo?: string;
  return?: number;
  airline?: string;
  operating_carrier?: string;
  bags_recheck_required?: boolean;
  utc_arrival?: string;
  utc_departure?: string;
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

// The identity of each flown segment, for the emissions lookup. Segments that
// are missing any part of the key are dropped rather than guessed — a wrong
// flight number returns someone else's aeroplane, not an error.
function flightSegments(segs: RouteLeg[]): FlightSegment[] {
  const out: FlightSegment[] = [];
  for (const s of segs) {
    const carrier = (s.operating_carrier || s.airline || "").trim();
    const noRaw = s.operating_flight_no || s.flight_no;
    const flightNo = Number(noRaw);
    const date = (s.local_departure ?? "").slice(0, 10);
    if (!carrier || !s.flyFrom || !s.flyTo || !Number.isFinite(flightNo)) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    out.push({ from: s.flyFrom, to: s.flyTo, carrier, flightNo, date });
  }
  return out;
}

// Distinct carriers on one direction, in flight order. Prefers the operating
// carrier: on a codeshare that is the airline you actually fly.
function carriersOf(segs: RouteLeg[]): string[] {
  const out: string[] = [];
  for (const s of segs) {
    const code = s.operating_carrier || s.airline;
    if (code && !out.includes(code)) out.push(code);
  }
  return out;
}

// Local-minus-UTC for the same instant, rounded to the quarter hour (some zones
// are :30 or :45). Null unless both stamps are present and the result is sane.
function offsetMinutes(
  localIso: string | undefined,
  utcIso: string | undefined
): number | null {
  if (!localIso || !utcIso) return null;
  const l = Date.parse(localIso.replace(/Z$/, ""));
  const u = Date.parse(utcIso.replace(/Z$/, ""));
  if (!isFinite(l) || !isFinite(u)) return null;
  const mins = Math.round((l - u) / 60000 / 15) * 15;
  return Math.abs(mins) <= 14 * 60 ? mins : null;
}

// Airports where the itinerary requires re-checking the bag. The flag sits on
// the segment you arrive on, so the airport is that segment's `flyTo`.
function recheckAirports(segs: RouteLeg[]): string[] {
  const out: string[] = [];
  for (const s of segs) {
    if (s.bags_recheck_required && s.flyTo && !out.includes(s.flyTo)) {
      out.push(s.flyTo);
    }
  }
  return out;
}

// Upstream reports leg durations in seconds. Anything non-finite or negative is
// treated as absent so callers fall back rather than render a nonsense figure.
function durationMin(seconds: unknown): number | null {
  return typeof seconds === "number" && isFinite(seconds) && seconds > 0
    ? Math.round(seconds / 60)
    : null;
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
      // Not just truthy: this string becomes an href. Kiwi is trusted, so the
      // practical risk is nil — but a scheme check is free, and "the upstream
      // would never send javascript:" is the assumption you only get to be
      // wrong about once.
      typeof deepLink !== "string" ||
      !deepLink.startsWith("https://") ||
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
      cityFrom: item?.cityFrom ?? "",
      countryTo: item?.countryTo?.name ?? "",
      flag: flagEmoji(item?.countryTo?.code ?? ""),
      flyFrom,
      flyTo,
      countryFrom: item?.countryFrom?.name ?? "",
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
      segments: flightSegments([...outSegs, ...inSegs]),
      outAirlines: carriersOf(outSegs),
      backAirlines: carriersOf(inSegs),
      destUtcOffsetMin: offsetMinutes(outLast?.local_arrival, outLast?.utc_arrival),
      selfTransfer: item?.virtual_interlining === true,
      bagRecheckAt: recheckAirports([...outSegs, ...inSegs]),
      outDurationMin: durationMin(item?.duration?.departure),
      backDurationMin: durationMin(item?.duration?.return),
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
