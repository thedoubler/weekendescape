"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { weekendRange } from "@/lib/format";
import { comparable, weekendSaving } from "@/lib/trip-facts";

// Session cache of the cheapest-weekend lookup, keyed by the full query — so
// re-opening a card (or the same destination) never re-fetches. Combined with
// the server-side cache, each destination costs at most one upstream search.
const CACHE = new Map<string, Deal | null>();

// Test hook — reset the session cache so cases don't leak into one another.
export function clearCheapestWeekendCache(): void {
  CACHE.clear();
}

export function CheapestWeekend({
  flyFrom,
  flyTo,
  cityTo,
  current,
  style,
  months,
  direct,
  adults,
}: {
  flyFrom: string;
  flyTo: string;
  cityTo: string;
  // The trip on the card, so the comparison can be all-in rather than fare-only.
  current: Deal;
  style: WeekendStyle;
  months: number;
  direct: boolean;
  adults: number;
}) {
  const key = `${flyFrom}:${flyTo}:${style}:${months}:${direct ? 1 : 0}:${adults}`;
  const [loading, setLoading] = useState(!CACHE.has(key));
  const [deal, setDeal] = useState<Deal | null>(() => CACHE.get(key) ?? null);

  useEffect(() => {
    // Deliberately an effect, not a render-phase adjustment. CACHE is module
    // state shared by every card, and the key omits dates — so two cards to the
    // same destination share one. Another card's fetch can land between this
    // render and this effect, meaning "cache miss at render time" is not a
    // reliable signal. Adopting the value here (rather than bailing out early)
    // is what stops that card from being stuck on "Checking…" forever.
    if (CACHE.has(key)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDeal(CACHE.get(key) ?? null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Match the same passenger count so the comparison price is apples-to-
        // apples (without adults it always priced 1 traveller — a false "cheaper").
        const qs = new URLSearchParams({
          flyFrom,
          flyTo,
          style,
          months: String(months),
          adults: String(adults),
        });
        if (direct) qs.set("direct", "1");
        const res = await fetch(`/api/weekends?${qs.toString()}`);
        const body = await res.json();
        const d: Deal | null = body.deals?.[0] ?? null;
        if (!cancelled) {
          CACHE.set(key, d);
          setDeal(d);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setDeal(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [key, flyFrom, flyTo, style, months, direct, adults]);

  // No reserved slot at all. It sat above the Book CTA and held 52px while the
  // lookup ran, then collapsed — so the button jumped up the moment the request
  // resolved to "no cheaper weekend", which is the common case. The row now
  // renders BELOW the CTA (see DealCard), where arriving late moves nothing
  // anyone is aiming at.
  if (loading) return null;
  if (!deal) return null;

  const saving = weekendSaving(current, deal, adults);
  // No row at all unless the difference is worth acting on. We also no longer
  // claim "cheapest weekend for {city}" — one origin, one style, one window and
  // one direct setting is not a claim we can stand behind.
  if (!saving) return null;

  return (
    <div className="mt-3 flex flex-col gap-1.5 border-t border-black/10 pt-3 dark:border-white/10">
      {/* The row used to appear under the cost table with nothing saying what
          it was: a second date and a second price, unlabelled, directly beneath
          the total for the trip you were reading about. */}
      <h5 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
        Cheaper on another weekend
      </h5>
      {/* The whole card is the link, and it never says "Book" — that word
          belongs to the primary CTA below, which books a different trip. */}
      <a
        href={deal.deepLink}
        target="_blank"
        rel="noopener noreferrer sponsored"
        aria-label={`See the ${weekendRange(deal.outDepart, deal.backArrive)} ${cityTo} trip on Kiwi.com (opens a new tab)`}
        className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-black/10 px-3 py-2 transition hover:border-black/25 hover:bg-black/[0.02] dark:border-white/15 dark:hover:border-white/30 dark:hover:bg-white/[0.03]"
      >
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium">
            {weekendRange(deal.outDepart, deal.backArrive)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {saving.amount} {deal.currency} less
            {saving.allIn ? ", with one checked bag" : " on the fare"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          {/* The all-in total when the saving is all-in, the fare when it
              isn't — so the reader can subtract this from the total above and
              land on the stated saving. */}
          <span className="text-sm font-semibold tabular-nums">
            {comparable(deal.price, deal.bagPrice, adults).value}{" "}
            {deal.currency}
          </span>
          <span aria-hidden className="text-black/35 dark:text-white/35">
            ›
          </span>
        </span>
      </a>
    </div>
  );
}
