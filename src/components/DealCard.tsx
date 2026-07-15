"use client";

import { useState } from "react";
import type { Deal } from "@/lib/deals";
import {
  dayLabel,
  timeLabel,
  durationLabel,
  dayBlocks,
  daysUntil,
} from "@/lib/format";
import { DayBlocks } from "@/components/DayBlocks";

export function DealCard({ deal }: { deal: Deal }) {
  const [open, setOpen] = useState(false);
  const cells = dayBlocks(deal.outDepart, deal.backArrive);
  const stay = durationLabel(deal.stayMinutes);
  const days = daysUntil(deal.outDepart, new Date());

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {deal.flag}
            </span>
            <span className="font-medium">{deal.cityTo}</span>
            <span className="text-sm opacity-60">{deal.countryTo}</span>
          </div>
          <div className="mt-2">
            <DayBlocks cells={cells} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-green-100 px-2.5 py-1 text-sm font-medium text-green-900 dark:bg-green-300/20 dark:text-green-100">
              {stay} in {deal.cityTo}
            </span>
          </div>
          <div className="mt-2 text-sm opacity-70">
            Out {dayLabel(deal.outDepart)} {timeLabel(deal.outDepart)} → land{" "}
            {timeLabel(deal.outArrive)} · back {dayLabel(deal.backDepart)}{" "}
            {timeLabel(deal.backDepart)}
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold">
            {deal.price} {deal.currency}
          </div>
          {days > 0 && (
            <div className="text-xs opacity-60">in {days} days</div>
          )}
          <a
            href={deal.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book ${deal.cityTo}`}
            className="text-sm underline"
          >
            Book
          </a>
        </div>
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-1 border-t border-black/10 pt-3 text-sm dark:border-white/10">
          <div>
            Outbound · {dayLabel(deal.outDepart)} {timeLabel(deal.outDepart)} →{" "}
            {deal.cityTo} {timeLabel(deal.outArrive)}
          </div>
          <div>
            Return · {dayLabel(deal.backDepart)} {timeLabel(deal.backDepart)} →
            home {timeLabel(deal.backArrive)}
          </div>
        </div>
      )}
    </div>
  );
}
