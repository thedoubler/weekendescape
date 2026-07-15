export interface Deal {
  cityTo: string;
  countryTo: string;
  flag: string;
  dateOut: string;
  dateBack: string;
  nights: number;
  price: number;
  currency: string;
  deepLink: string;
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
  return?: number;
}

function datepart(iso: string | undefined): string | null {
  if (!iso || typeof iso !== "string") return null;
  const part = iso.split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(part) ? part : null;
}

export function normalizeDeals(raw: unknown, currency: string): Deal[] {
  const data =
    raw && typeof raw === "object" && Array.isArray((raw as any).data)
      ? ((raw as any).data as any[])
      : [];

  const deals: Deal[] = [];
  for (const item of data) {
    const route: RouteLeg[] = Array.isArray(item?.route) ? item.route : [];
    const outLeg = route[0];
    const backLeg = route.find((l) => l?.return === 1);
    const dateOut = datepart(outLeg?.local_departure);
    const dateBack = datepart(backLeg?.local_departure);
    const cityTo = item?.cityTo;
    const price = item?.price;
    const deepLink = item?.deep_link;

    if (
      !cityTo ||
      typeof price !== "number" ||
      !deepLink ||
      !dateOut ||
      !dateBack
    ) {
      continue;
    }

    deals.push({
      cityTo,
      countryTo: item?.countryTo?.name ?? "",
      flag: flagEmoji(item?.countryTo?.code ?? ""),
      dateOut,
      dateBack,
      nights:
        typeof item?.nightsInDest === "number" ? item.nightsInDest : 0,
      price,
      currency,
      deepLink,
    });
  }

  return deals.sort((a, b) => a.price - b.price);
}
