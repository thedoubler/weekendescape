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
