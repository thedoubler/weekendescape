"use client";

import { useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { CheapestWeekend } from "@/components/CheapestWeekend";
import {
  dayLabel,
  timeLabel,
  durationLabel,
  daysUntil,
  dayBlocks,
  crossesMidnight,
  isNightHour,
  travelMinutes,
  valueVerdict,
  holidayDate,
  stopsSummary,
} from "@/lib/format";
import { DayBlocks } from "@/components/DayBlocks";

export function DealCard({
  deal,
  cheapest,
}: {
  deal: Deal;
  cheapest?: { style: WeekendStyle; months: number; direct: boolean };
}) {
  const [open, setOpen] = useState(false);
  const cells = dayBlocks(deal.outArrive, deal.backDepart);
  const stay = durationLabel(deal.stayMinutes);
  const days = daysUntil(deal.outDepart, new Date());
  const arrival = {
    time: timeLabel(deal.outArrive),
    night: isNightHour(deal.outArrive),
    plusOne: crossesMidnight(deal.outDepart, deal.outArrive),
  };
  const departure = {
    time: timeLabel(deal.backDepart),
    night: isNightHour(deal.backDepart),
  };
  const returnPlusOne = crossesMidnight(deal.backDepart, deal.backArrive);
  const direct = deal.outStops === 0 && deal.backStops === 0;
  const stops = stopsSummary(deal.outStops, deal.backStops);
  const verdict = valueVerdict(
    deal.stayMinutes,
    travelMinutes(deal.outDepart, deal.outArrive, deal.backDepart, deal.backArrive)
  );
  const verdictClass =
    verdict.tier === "great"
      ? "border border-green-300 text-green-800 dark:border-green-400/40 dark:text-green-200"
      : verdict.tier === "fair"
        ? "border border-black/15 text-black/60 dark:border-white/20 dark:text-white/70"
        : "text-black/45 dark:text-white/45";

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-4">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="flex-1 text-left"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xl" aria-hidden>
              {deal.flag}
            </span>
            <span className="font-medium">{deal.cityTo}</span>
            <span className="text-sm opacity-60">{deal.countryTo}</span>
            <span className="rounded-full border border-black/15 px-2 py-0.5 text-xs opacity-70 dark:border-white/20">
              {deal.flyFrom} → {deal.flyTo}
            </span>
            <span
              className={
                direct
                  ? "text-xs opacity-50"
                  : "rounded-full border border-amber-300/60 px-2 py-0.5 text-xs text-amber-800 dark:text-amber-200"
              }
            >
              {stops}
            </span>
          </div>
          <div className="mt-2">
            <DayBlocks cells={cells} arrival={arrival} departure={departure} />
          </div>
        </button>
        <div className="text-right shrink-0">
          <div className="text-lg font-semibold">
            {deal.price} {deal.currency}
          </div>
          {days > 0 && <div className="text-xs opacity-60">in {days} days</div>}
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

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-green-100 px-2.5 py-1 text-sm font-medium text-green-900 dark:bg-green-300/20 dark:text-green-100">
          {stay} in {deal.cityTo}
        </span>
        <span className={`rounded-full px-2.5 py-1 text-sm ${verdictClass}`}>
          {verdict.label}
        </span>
        {deal.homeHoliday && (
          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm text-amber-900 dark:bg-amber-300/20 dark:text-amber-100">
            🎉 {deal.homeHoliday.name} · {holidayDate(deal.homeHoliday.date)} —{" "}
            {deal.ptoDays === 0
              ? "no day off needed"
              : `${deal.ptoDays} day${deal.ptoDays === 1 ? "" : "s"} off`}
          </span>
        )}
        {deal.destHoliday && (
          <span className="rounded-full border border-amber-300/50 px-2.5 py-1 text-sm text-amber-800 dark:text-amber-200">
            {deal.destHoliday.name} · {holidayDate(deal.destHoliday.date)} in{" "}
            {deal.cityTo}
          </span>
        )}
      </div>

      {open && (
        <div className="mt-3 flex flex-col gap-1 border-t border-black/10 pt-3 text-sm dark:border-white/10">
          <div>
            Outbound · {dayLabel(deal.outDepart)} {timeLabel(deal.outDepart)}{" "}
            {deal.flyFrom} → {deal.flyTo} {timeLabel(deal.outArrive)}
            {arrival.plusOne ? " +1" : ""}
            {deal.outStops > 0 && (
              <span className="opacity-60">
                {" "}
                · {deal.outStops} stop{deal.outStops > 1 ? "s" : ""} via{" "}
                {deal.outLayovers
                  .map((l) => `${l.at} (${durationLabel(l.minutes)})`)
                  .join(", ")}
              </span>
            )}
          </div>
          <div>
            Return · {dayLabel(deal.backDepart)} {timeLabel(deal.backDepart)}{" "}
            {deal.flyTo} → {deal.flyFrom} {timeLabel(deal.backArrive)}
            {returnPlusOne ? " +1" : ""}
            {deal.backStops > 0 && (
              <span className="opacity-60">
                {" "}
                · {deal.backStops} stop{deal.backStops > 1 ? "s" : ""} via{" "}
                {deal.backLayovers
                  .map((l) => `${l.at} (${durationLabel(l.minutes)})`)
                  .join(", ")}
              </span>
            )}
          </div>
          {cheapest && (
            <div className="mt-1 border-t border-black/10 pt-2 dark:border-white/10">
              <CheapestWeekend
                flyFrom={deal.flyFrom}
                flyTo={deal.flyTo}
                cityTo={deal.cityTo}
                currentPrice={deal.price}
                style={cheapest.style}
                months={cheapest.months}
                direct={cheapest.direct}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
