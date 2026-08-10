// Sunrise and sunset from coordinates and a date — NOAA's solar position
// algorithm, no network and no dependency.
//
// This is the only fact on a card that needs no caveat at all: it is astronomy,
// exact for a trip five months out and five days out alike, and it never goes
// stale. On a 48-hour trip it also decides something real — landing at 16:20 in
// November means day one is over before it starts, and nothing else on the card
// says so.

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export interface SunTimes {
  // Minutes after local midnight. Null at high latitudes where the sun does not
  // rise or set at all on the date — those are real places we sell flights to
  // (Tromsø, Rovaniemi), so they get their own copy rather than a NaN.
  sunriseMin: number | null;
  sunsetMin: number | null;
  // Whole-day states, when there is no rise/set to report.
  polar: "midnight-sun" | "polar-night" | null;
  daylightMin: number;
}

function dayOfYear(y: number, m: number, d: number): number {
  return Math.round(
    (Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86400000
  );
}

// `utcOffsetMin` is the destination's offset ON THAT DATE. It must come from the
// itinerary, never from the reader's own clock: the panel is a client component
// and the user may be in a different zone entirely.
export function sunTimes(
  lat: number,
  lon: number,
  isoDate: string,
  utcOffsetMin: number
): SunTimes | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m || !isFinite(lat) || !isFinite(lon)) return null;
  const n = dayOfYear(+m[1], +m[2], +m[3]);

  // Solar declination and the equation of time (minutes).
  const gamma = ((2 * Math.PI) / 365) * (n - 1);
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));

  // Zenith 90.833° folds in refraction and the sun's disc.
  const cosH =
    (Math.cos(90.833 * DEG) - Math.sin(lat * DEG) * Math.sin(decl)) /
    (Math.cos(lat * DEG) * Math.cos(decl));

  if (cosH > 1) {
    return { sunriseMin: null, sunsetMin: null, polar: "polar-night", daylightMin: 0 };
  }
  if (cosH < -1) {
    return { sunriseMin: null, sunsetMin: null, polar: "midnight-sun", daylightMin: 1440 };
  }

  const ha = Math.acos(cosH) * RAD;
  const noonMin = 720 - 4 * lon - eqTime + utcOffsetMin;
  const sunriseMin = noonMin - 4 * ha;
  const sunsetMin = noonMin + 4 * ha;
  return {
    sunriseMin,
    sunsetMin,
    polar: null,
    daylightMin: sunsetMin - sunriseMin,
  };
}

export function clockLabel(minutes: number): string {
  const wrapped = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const mi = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

// Fire only when daylight actually constrains the trip.
//
// Calibrated against a real 63-deal board (CLJ, 6-month window) rather than
// intuition. Arrival alone is the wrong trigger: landing after sunset on a
// Friday is NORMAL — you fly after work — and firing on it alone lit up 61% of
// cards, which makes the line a constant rather than a signal. Gating on the
// day itself being short brings it to 28%, inside the "≤25-30% of a board"
// budget the rest of the conditionals keep.
//
//   arrival trigger, no gate                   61% of cards
//   + short-day gate, but keeping a generic
//     "short days" fallback for every winter
//     card                                     57%   ← still a constant
//   + short-day gate, arrival-constrained
//     cases only                               28%   ← shipped
//
// The generic fallback was the noisy branch: "short days in December" is true
// of the whole season, not of this flight. What is worth a row is what THIS
// arrival does to the daylight you get.
export const SHORT_DAY_MIN = 11 * 60;
export const TIGHT_ARRIVAL_MIN = 3 * 60;

// The one sentence worth showing, or null to stay silent. Deliberately says
// "sunset", never "dark": civil twilight runs well past sunset, so claiming
// darkness would be overstating a fact we can state exactly.
export function daylightNote(
  coords: [number, number] | null | undefined,
  arriveIso: string,
  utcOffsetMin: number
): string | null {
  if (!coords) return null;
  const t = sunTimes(coords[0], coords[1], arriveIso, utcOffsetMin);
  if (!t) return null;

  if (t.polar === "polar-night") return "Polar night — the sun stays down.";
  if (t.polar === "midnight-sun") return "Midnight sun — it never gets dark.";
  if (t.sunsetMin == null || t.sunriseMin == null) return null;

  // Nothing to say when the day is long: an evening arrival in June costs you
  // nothing you'd have used.
  if (t.daylightMin >= SHORT_DAY_MIN) return null;

  const hm = /T(\d{2}):(\d{2})/.exec(arriveIso);
  const arriveMin = hm ? +hm[1] * 60 + +hm[2] : null;
  if (arriveMin != null && arriveMin > t.sunsetMin) {
    return `You land after sunset — sunrise ${clockLabel(t.sunriseMin)} the next day.`;
  }
  if (arriveMin != null && t.sunsetMin - arriveMin < TIGHT_ARRIVAL_MIN) {
    const left = Math.round((t.sunsetMin - arriveMin) / 60);
    return `About ${left}h of daylight after you land — sunset ${clockLabel(t.sunsetMin)}.`;
  }
  // Short day, but you land with most of it ahead of you — nothing to say.
  return null;
}
