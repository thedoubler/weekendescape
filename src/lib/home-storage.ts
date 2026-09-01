export const HOME_KEY = "weekendescape:home";

const IATA_RE = /^[A-Z]{3}$/;

// Home airports, persisted as a comma-separated list. Reads written before
// multi-origin support hold a single bare code, which parses identically — so
// no migration is needed.
// Every access is guarded, and not out of caution: with "block all cookies"
// set, or inside some embedded webviews, READING window.localStorage throws a
// SecurityError on the property itself rather than returning null. loadHomes()
// runs during boot, so an unguarded access there was a blank page for those
// visitors — not a lost preference.
export function loadHomes(): string[] {
  if (typeof window === "undefined") return [];
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(HOME_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const code = part.trim().toUpperCase();
    if (IATA_RE.test(code) && !out.includes(code)) out.push(code);
  }
  return out;
}

export function saveHomes(codes: string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HOME_KEY, codes.join(",").toUpperCase());
  } catch {
    // Storage blocked or full. The airport still works for this session; it
    // just will not be remembered, which is not worth an error to the user.
  }
}

// Single-code accessors, kept for callers that only care about the primary.
export function loadHome(): string | null {
  return loadHomes()[0] ?? null;
}

export function saveHome(code: string): void {
  saveHomes([code]);
}

// The traveller's region for public-holiday purposes — an ISO-3166-2 code
// ("ES-CT") or the literal "national". Only an EXPLICIT choice is stored;
// while unset the server infers from the home airports on every search, so a
// changed home keeps working without a stale guess. A stored code from a
// previous home country is harmless: the server resolves an out-of-country
// code back to inference. Same guarded access as loadHomes above.
export const REGION_KEY = "weekendescape:region";
const REGION_RE = /^(national|[A-Z]{2}-[A-Z0-9]{1,3})$/;

export function loadRegion(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(REGION_KEY);
    return raw && REGION_RE.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

export function saveRegion(value: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value && REGION_RE.test(value))
      window.localStorage.setItem(REGION_KEY, value);
    else window.localStorage.removeItem(REGION_KEY);
  } catch {
    // Storage blocked or full — the choice still applies for this session.
  }
}
