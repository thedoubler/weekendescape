import type { Deal } from "@/lib/deals";

export type SortKey = "soonest" | "cheapest" | "closest";

export function sortDeals(deals: Deal[], key: SortKey): Deal[] {
  const arr = [...deals];
  if (key === "cheapest") {
    arr.sort(
      (a, b) => a.price - b.price || a.outDepart.localeCompare(b.outDepart)
    );
  } else if (key === "closest") {
    // Nearest airport-to-city first; unknown distances sink to the bottom.
    arr.sort((a, b) => {
      const ka = a.airportKmFromCity ?? Infinity;
      const kb = b.airportKmFromCity ?? Infinity;
      return ka - kb || a.price - b.price;
    });
  } else {
    arr.sort(
      (a, b) => a.outDepart.localeCompare(b.outDepart) || a.price - b.price
    );
  }
  return arr;
}

// Keep deals whose airport is within maxKm of the city — or whose distance we
// couldn't measure (never hide a deal just because it's unknown).
export function filterByMaxAirportKm(deals: Deal[], maxKm: number): Deal[] {
  return deals.filter(
    (d) => d.airportKmFromCity == null || d.airportKmFromCity <= maxKm
  );
}

// How many deals are known to have a far-out airport (so the UI can decide
// whether the "in-town only" control is worth showing).
export function farAirportCount(deals: Deal[], maxKm: number): number {
  return deals.filter(
    (d) => d.airportKmFromCity != null && d.airportKmFromCity > maxKm
  ).length;
}

export function monthsOf(deals: Deal[]): string[] {
  const set = new Set<string>();
  for (const deal of deals) set.add(deal.outDepart.slice(0, 7));
  return [...set].sort();
}

export function filterByMonths(deals: Deal[], months: string[]): Deal[] {
  if (months.length === 0) return [...deals];
  const set = new Set(months);
  return deals.filter((deal) => set.has(deal.outDepart.slice(0, 7)));
}

export function priceRange(deals: Deal[]): { min: number; max: number } {
  if (deals.length === 0) return { min: 0, max: 0 };
  let min = deals[0].price;
  let max = deals[0].price;
  for (const d of deals) {
    if (d.price < min) min = d.price;
    if (d.price > max) max = d.price;
  }
  return { min, max };
}

export function filterByMaxPrice(deals: Deal[], maxPrice: number): Deal[] {
  return deals.filter((deal) => deal.price <= maxPrice);
}
