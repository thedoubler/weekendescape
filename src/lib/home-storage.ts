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
