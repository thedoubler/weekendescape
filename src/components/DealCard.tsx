"use client";

import { useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { CheapestWeekend } from "@/components/CheapestWeekend";
import {
  dateWithMonth,
  timeLabel,
  durationLabel,
  daysUntil,
  dayBlocks,
  crossesMidnight,
  isNightHour,
  legMinutes,
  travelMinutes,
  holidayDate,
  stopsSummary,
  weekendRange,
} from "@/lib/format";
import type { Layover } from "@/lib/deals";
import { hotelUrl } from "@/lib/hotels";
import { DayBlocks } from "@/components/DayBlocks";

function Leg({
  label,
  date,
  depTime,
  depCode,
  arrTime,
  arrCode,
  plusOne,
  minutes,
  stops,
  layovers,
}: {
  label: string;
  date: string;
  depTime: string;
  depCode: string;
  arrTime: string;
  arrCode: string;
  plusOne: boolean;
  minutes: number;
  stops: number;
  layovers: Layover[];
}) {
  const via = layovers
    .map((l) => `${l.at} (${durationLabel(l.minutes)})`)
    .join(", ");
  const stopLabel =
    stops === 0 ? "Direct" : `${stops} stop${stops > 1 ? "s" : ""}`;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11px] uppercase tracking-wide text-black/40 dark:text-white/40">
        <span className="font-semibold">{label}</span>
        <span>{date}</span>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="w-14 shrink-0">
          <div className="text-[15px] font-semibold leading-none tabular-nums">
            {depTime}
          </div>
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            {depCode}
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <span className="text-[11px] text-black/45 dark:text-white/45">
            {durationLabel(minutes)}
          </span>
          <div className="my-1 flex w-full items-center gap-1">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-black/30 dark:border-white/30" />
            <span className="h-px flex-1 bg-black/15 dark:bg-white/15" />
            <span aria-hidden className="shrink-0 text-black/35 dark:text-white/35">
              ✈
            </span>
            <span className="h-px flex-1 bg-black/15 dark:bg-white/15" />
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-black/30 dark:bg-white/30" />
          </div>
          <span
            className={`truncate text-[11px] ${
              stops === 0
                ? "text-black/45 dark:text-white/45"
                : "text-amber-700 dark:text-amber-300"
            }`}
          >
            {stopLabel}
            {via ? ` · via ${via}` : ""}
          </span>
        </div>
        <div className="w-14 shrink-0 text-right">
          <div className="text-[15px] font-semibold leading-none tabular-nums">
            {arrTime}
            {plusOne && (
              <span className="align-super text-[9px] font-normal text-black/45 dark:text-white/45">
                +1
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-black/50 dark:text-white/50">
            {arrCode}
          </div>
        </div>
      </div>
    </div>
  );
}

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
  // Round-trip air time = total transit minus the layover waits.
  const layoverMinutes = [...deal.outLayovers, ...deal.backLayovers].reduce(
    (sum, l) => sum + l.minutes,
    0
  );
  const flyingMinutes =
    travelMinutes(
      deal.outDepart,
      deal.outArrive,
      deal.backDepart,
      deal.backArrive
    ) - layoverMinutes;

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-center gap-2">
            <span className="text-xl" aria-hidden>
              {deal.flag}
            </span>
            <span className="truncate text-lg font-semibold">
              {deal.cityTo}
            </span>
          </div>
          <div className="mt-0.5 text-xs">
            <span className="font-medium text-black/70 dark:text-white/70">
              {weekendRange(deal.outDepart, deal.backArrive)}
            </span>
            <span className="text-black/35 dark:text-white/35"> · </span>
            <span
              className={
                direct
                  ? "text-black/45 dark:text-white/45"
                  : "font-medium text-amber-700 dark:text-amber-300"
              }
            >
              {stops}
            </span>
          </div>
        </button>
        <div className="shrink-0 text-right">
          <div className="text-lg font-semibold">
            {deal.price} {deal.currency}
          </div>
          {days > 0 && (
            <div className="text-xs text-black/50 dark:text-white/50">
              in {days} days
            </div>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Hide details" : "Show details"}
        className="mt-3 block w-full text-left"
      >
        <DayBlocks cells={cells} arrival={arrival} departure={departure} />
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-green-100 px-2.5 py-1 text-sm font-medium text-green-900 dark:bg-green-300/20 dark:text-green-100">
            {stay} there
          </span>
          <span className="text-sm text-black/55 dark:text-white/55">
            ≈ {durationLabel(flyingMinutes)} flying
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={hotelUrl(deal)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={`Find a hotel in ${deal.cityTo}`}
            className="text-sm text-black/55 underline underline-offset-2 hover:text-black dark:text-white/55 dark:hover:text-white"
          >
            🛏 Stay
          </a>
          <a
            href={deal.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book ${deal.cityTo}`}
            className="text-sm font-medium text-black underline underline-offset-2 dark:text-white"
          >
            Book ↗
          </a>
        </div>
      </div>

      {(deal.homeHoliday || deal.destHoliday) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {deal.homeHoliday && (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-sm text-amber-900 dark:bg-amber-300/20 dark:text-amber-100">
              🎉 {deal.homeHoliday.name} · {holidayDate(deal.homeHoliday.date)} —{" "}
              {deal.ptoDays === 0
                ? "no day off needed"
                : `${deal.ptoDays} day${deal.ptoDays === 1 ? "" : "s"} off`}
            </span>
          )}
          {deal.destHoliday && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-300/60 px-2.5 py-0.5 text-xs text-rose-700 dark:border-rose-400/30 dark:text-rose-300">
              🎊
              <span>
                Public holiday · {deal.destHoliday.name} ·{" "}
                {holidayDate(deal.destHoliday.date)}
              </span>
            </span>
          )}
        </div>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3 text-sm dark:border-white/10">
          <Leg
            label="Outbound"
            date={dateWithMonth(deal.outDepart)}
            depTime={timeLabel(deal.outDepart)}
            depCode={deal.flyFrom}
            arrTime={timeLabel(deal.outArrive)}
            arrCode={deal.flyTo}
            plusOne={arrival.plusOne}
            minutes={legMinutes(deal.outDepart, deal.outArrive)}
            stops={deal.outStops}
            layovers={deal.outLayovers}
          />
          <Leg
            label="Return"
            date={dateWithMonth(deal.backDepart)}
            depTime={timeLabel(deal.backDepart)}
            depCode={deal.flyTo}
            arrTime={timeLabel(deal.backArrive)}
            arrCode={deal.flyFrom}
            plusOne={returnPlusOne}
            minutes={legMinutes(deal.backDepart, deal.backArrive)}
            stops={deal.backStops}
            layovers={deal.backLayovers}
          />
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
