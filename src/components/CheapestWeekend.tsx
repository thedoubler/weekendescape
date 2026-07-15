"use client";

import { useEffect, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { dayLabel } from "@/lib/format";

export function CheapestWeekend({
  flyFrom,
  flyTo,
  cityTo,
  currentPrice,
  style,
  months,
  direct,
}: {
  flyFrom: string;
  flyTo: string;
  cityTo: string;
  currentPrice: number;
  style: WeekendStyle;
  months: number;
  direct: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [deal, setDeal] = useState<Deal | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const qs = new URLSearchParams({
          flyFrom,
          flyTo,
          style,
          months: String(months),
        });
        if (direct) qs.set("direct", "1");
        const res = await fetch(`/api/weekends?${qs.toString()}`);
        const body = await res.json();
        if (!cancelled) {
          setDeal(body.deals?.[0] ?? null);
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
  }, [flyFrom, flyTo, style, months, direct]);

  if (loading)
    return (
      <div className="text-xs opacity-60">Finding the cheapest weekend…</div>
    );
  if (!deal) return null;

  if (deal.price >= currentPrice)
    return (
      <div className="text-xs opacity-60">
        ✓ This is the cheapest weekend for {cityTo}.
      </div>
    );

  return (
    <div className="text-sm">
      💡 Cheapest weekend:{" "}
      <span className="font-medium">
        {deal.price} {deal.currency}
      </span>{" "}
      · {dayLabel(deal.outDepart)} → {dayLabel(deal.backArrive)}{" "}
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
