export const HOME_KEY = "weekendescape:home";

const IATA_RE = /^[A-Z]{3}$/;

// Home airports, persisted as a comma-separated list. Reads written before
// multi-origin support hold a single bare code, which parses identically — so
// no migration is needed.
export function loadHomes(): string[] {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(HOME_KEY);
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
  window.localStorage.setItem(HOME_KEY, codes.join(",").toUpperCase());
}

// Single-code accessors, kept for callers that only care about the primary.
export function loadHome(): string | null {
  return loadHomes()[0] ?? null;
}

export function saveHome(code: string): void {
  saveHomes([code]);
}
