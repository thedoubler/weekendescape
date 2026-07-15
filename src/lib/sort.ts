import type { Deal } from "@/lib/deals";

export type SortKey = "soonest" | "cheapest";

export function sortDeals(deals: Deal[], key: SortKey): Deal[] {
  const arr = [...deals];
  if (key === "cheapest") {
    arr.sort(
      (a, b) => a.price - b.price || a.outDepart.localeCompare(b.outDepart)
    );
  } else {
    arr.sort(
      (a, b) => a.outDepart.localeCompare(b.outDepart) || a.price - b.price
    );
  }
  return arr;
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
