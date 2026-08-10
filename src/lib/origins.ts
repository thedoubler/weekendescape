// Home airports. The board searches from one to three origins at once — useful
// where a second airport is a realistic alternative (BCN/GRO, LON's six, MIL's
// three), and capped because every extra origin multiplies the upstream search.

export const MAX_ORIGINS = 3;

const IATA_RE = /^[A-Z]{3}$/;

// Parse a user- or URL-supplied list into clean IATA codes: uppercased,
// de-duplicated, invalid entries dropped, capped. Order is the user's — it is
// what the chips render in — so this deliberately does NOT sort.
export function parseOrigins(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const code = part.trim().toUpperCase();
    if (!IATA_RE.test(code) || out.includes(code)) continue;
    out.push(code);
    if (out.length === MAX_ORIGINS) break;
  }
  return out;
}

// The form Kiwi and our URL both want.
export function serializeOrigins(codes: string[]): string {
  return codes.join(",");
}

// Order-independent identity, for cache keys: searching BCN,GRO must hit the
// same cache entry as GRO,BCN rather than paying for the same result twice.
export function originsCacheKey(codes: string[]): string {
  return [...codes].sort().join(",");
}

export function canAddOrigin(codes: string[], code: string): boolean {
  const c = code.trim().toUpperCase();
  return (
    IATA_RE.test(c) && !codes.includes(c) && codes.length < MAX_ORIGINS
  );
}

export function addOrigin(codes: string[], code: string): string[] {
  const c = code.trim().toUpperCase();
  return canAddOrigin(codes, c) ? [...codes, c] : codes;
}

export function removeOrigin(codes: string[], code: string): string[] {
  return codes.filter((c) => c !== code.trim().toUpperCase());
}
