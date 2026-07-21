"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { dateWithMonth } from "@/lib/format";

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
  currentPrice,
  style,
  months,
  direct,
  adults,
}: {
  flyFrom: string;
  flyTo: string;
  cityTo: string;
  currentPrice: number;
  style: WeekendStyle;
  months: number;
  direct: boolean;
  adults: number;
}) {
  const key = `${flyFrom}:${flyTo}:${style}:${months}:${direct ? 1 : 0}:${adults}`;
  const [loading, setLoading] = useState(!CACHE.has(key));
  const [deal, setDeal] = useState<Deal | null>(() => CACHE.get(key) ?? null);

  useEffect(() => {
    if (CACHE.has(key)) {
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

  if (loading)
    return (
      <div className="text-xs opacity-60">Checking for a cheaper weekend…</div>
    );
  if (!deal) return null;

  if (deal.price >= currentPrice)
    return (
      <div className="text-xs opacity-60">
        ✓ Cheapest weekend for {cityTo}.
      </div>
    );

  return (
    <div className="text-sm">
      💡 Cheaper weekend:{" "}
      <span className="font-medium">
        {deal.price} {deal.currency}
      </span>{" "}
      · {dateWithMonth(deal.outDepart)} → {dateWithMonth(deal.backArrive)}{" "}
      <a
        href={deal.deepLink}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Book cheapest ${cityTo}`}
        className="underline"
      >
        Book
      </a>
    </div>
  );
}
