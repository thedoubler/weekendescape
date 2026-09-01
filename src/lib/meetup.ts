import type { Deal } from "@/lib/deals";
import { weekendKey } from "@/lib/calendar";

// Meet-up mode: several home airports, one destination, the SAME weekend.
// Each origin runs its own search; this module intersects them — a
// destination survives only when every origin can reach it on one shared
// weekend (same Saturday anchor, the board's usual weekend identity). The
// result is one combined deal per destination: the cheapest shared weekend,
// priced as the TOTAL of one fare per person, with a leg row per origin so
// each traveller books their own flight.

export interface MeetupLeg {
  flyFrom: string;
  cityFrom: string;
  price: number;
  currency: string;
  deepLink: string;
  outDepart: string;
  backDepart: string;
}

/** cityTo|weekend → cheapest deal, for one origin's results. */
function byCityWeekend(deals: Deal[]): Map<string, Deal> {
  const m = new Map<string, Deal>();
  for (const d of deals) {
    const key = `${d.cityTo}|${weekendKey(d.outDepart.slice(0, 10))}`;
    const cur = m.get(key);
    if (!cur || d.price < cur.price) m.set(key, d);
  }
  return m;
}

export function combineMeetup(perOrigin: Deal[][]): Deal[] {
  if (perOrigin.length < 2) return perOrigin[0] ?? [];
  const maps = perOrigin.map(byCityWeekend);
  // Walk the smallest map — the intersection can't be bigger than it.
  const [first, ...rest] = [...maps].sort((a, b) => a.size - b.size);

  // Cheapest shared weekend per DESTINATION, mirroring the normal board's
  // one-card-per-city shape (one_for_city upstream).
  const perCity = new Map<string, Deal>();
  for (const [key, seed] of first) {
    const partners = rest.map((m) => m.get(key));
    if (partners.some((p) => !p)) continue;
    const legs = [seed, ...(partners as Deal[])];
    const total = legs.reduce((s, l) => s + l.price, 0);
    const city = seed.cityTo;
    const cur = perCity.get(city);
    if (cur && cur.price <= total) continue;
    // The combined card wears the cheapest leg's itinerary (day strip, times,
    // bags); the rows below carry every traveller's own fare and link. price
    // becomes the total so sorting, the price filter, the calendar and the
    // map all read the number a meet-up actually costs.
    const primary = [...legs].sort((a, b) => a.price - b.price)[0];
    perCity.set(city, {
      ...primary,
      price: total,
      meetup: legs
        .map((l) => ({
          flyFrom: l.flyFrom,
          cityFrom: l.cityFrom,
          price: l.price,
          currency: l.currency,
          deepLink: l.deepLink,
          outDepart: l.outDepart,
          backDepart: l.backDepart,
        }))
        .sort((a, b) => a.flyFrom.localeCompare(b.flyFrom)),
    });
  }
  return [...perCity.values()].sort((a, b) => a.price - b.price);
}
