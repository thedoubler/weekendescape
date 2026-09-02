import type { Deal } from "@/lib/deals";
import { weekendKey } from "@/lib/calendar";

// Meet-up mode: several home airports, one destination, the SAME weekend.
// Each origin runs its own search; this module intersects them — a
// destination survives only when every origin can reach it on one shared
// weekend (same Saturday anchor, the board's usual weekend identity). The
// result is one combined deal per destination: the cheapest shared weekend,
// priced as the TOTAL of one fare per person, with a leg row per origin so
// each traveller books their own flight.

// Each meet-up row is the traveller's FULL itinerary. It started as a slim
// projection (code, price, times, link) and grew back: the expanded panel
// shows every traveller's legs, layovers, carriers and bags, and a slim row
// can't answer any of that. The together-window derives from outArrive (it
// opens at the LATEST landing) and backDepart (closes at the EARLIEST
// departure home).
export type MeetupLeg = Deal;

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
    // Same weekend is necessary but not sufficient: if the last person to
    // land arrives after the first person flies home, they never coexist and
    // calling it a meet-up would be false. All legs share the destination's
    // timezone, so lexicographic ISO comparison is a real time comparison.
    // Six hours is the floor — enough for a dinner, which is the least a
    // trip sold as "meet up" can honestly deliver.
    const MIN_TOGETHER_MS = 6 * 3600000;
    const allLanded = legs.map((l) => l.outArrive).sort().at(-1)!;
    const firstLeaves = legs.map((l) => l.backDepart).sort()[0];
    if (Date.parse(firstLeaves) - Date.parse(allLanded) < MIN_TOGETHER_MS)
      continue;
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
        .map((l) => ({ ...l }))
        .sort((a, b) => a.flyFrom.localeCompare(b.flyFrom)),
    });
  }
  return [...perCity.values()].sort((a, b) => a.price - b.price);
}
