"use client";

import { useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import type { WeatherResult } from "@/lib/weather";
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
  holidayDate,
  stopsSummary,
  weekendRange,
} from "@/lib/format";
import type { Layover } from "@/lib/deals";
import { hotelUrl } from "@/lib/hotels";
import { airlineName } from "@/lib/airlines";
import { DayBlocks } from "@/components/DayBlocks";

// Below this the airport is "in town" enough not to warrant a caveat; above it
// (Charleroi/Brussels, Beauvais/Paris…) the transfer is worth surfacing.
const FAR_AIRPORT_KM = 30;

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
                : "font-medium text-black/60 dark:text-white/60"
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

// Inline icons (Lucide, currentColor) so the Stay/Book actions render
// consistently across platforms and adapt to light/dark — unlike emoji.
function BedIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" />
      <path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4" />
      <path d="M2 18h20" />
      <path d="M12 4v6" />
    </svg>
  );
}

function ExternalLinkIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6" />
    </svg>
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
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // Weather is fetched lazily the first time a card is expanded, so the list
  // view stays free of per-destination network calls.
  const weatherTried = useRef(false);

  useEffect(() => {
    if (!open || weatherTried.current) return;
    weatherTried.current = true;
    const from = deal.outArrive.slice(0, 10);
    const to = deal.backDepart.slice(0, 10);
    const params = new URLSearchParams({ iata: deal.flyTo, from, to });
    setWeatherLoading(true);
    fetch(`/api/weather?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setWeather(d?.weather ?? null))
      .catch(() => setWeather(null))
      .finally(() => setWeatherLoading(false));
  }, [open, deal.flyTo, deal.outArrive, deal.backDepart]);

  const cells = dayBlocks(deal.outArrive, deal.backDepart);
  const stay = durationLabel(deal.stayMinutes);
  // Reserve the positive green for stays that actually earn it — a day and a
  // half or more at the destination. Shorter (red-eye) stays get a neutral pill
  // so the colour isn't a false "good" signal.
  const goodStay = deal.stayMinutes >= 36 * 60;
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
  const airlines = deal.airlines ?? [];

  return (
    <div className="rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="min-w-0 flex-1 text-left"
        >
          <div className="flex items-start gap-2">
            <span className="text-xl leading-tight" aria-hidden>
              {deal.flag}
            </span>
            <span className="text-lg font-semibold leading-tight [overflow-wrap:anywhere] line-clamp-2">
              {deal.cityTo}
              {deal.countryTo && (
                <span className="ml-1.5 text-sm font-normal text-black/45 dark:text-white/45">
                  {deal.countryTo}
                </span>
              )}
            </span>
          </div>
          <div className="mt-0.5 text-xs">
            <span className="font-medium text-black/70 dark:text-white/70">
              {weekendRange(deal.outArrive, deal.backDepart)}
            </span>
            <span className="text-black/35 dark:text-white/35"> · </span>
            <span
              className={
                direct
                  ? "text-black/45 dark:text-white/45"
                  : "font-medium text-black/70 dark:text-white/70"
              }
            >
              {stops}
            </span>
          </div>
          {deal.airportKmFromCity != null &&
            deal.airportKmFromCity >= FAR_AIRPORT_KM && (
              <div className="mt-1 inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400/90">
                <span aria-hidden>✈</span>
                <span>
                  Airport {deal.airportKmFromCity} km from {deal.cityTo}
                </span>
              </div>
            )}
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
        <DayBlocks
          cells={cells}
          arrival={arrival}
          departure={departure}
          holiday={deal.destHoliday}
        />
      </button>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-sm font-medium ${
              goodStay
                ? "bg-green-100 text-green-900 dark:bg-green-300/20 dark:text-green-100"
                : "bg-black/[0.06] text-black/70 dark:bg-white/10 dark:text-white/70"
            }`}
          >
            {stay} to explore
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={hotelUrl(deal)}
            target="_blank"
            rel="noopener noreferrer sponsored"
            aria-label={`Find a hotel in ${deal.cityTo}`}
            className="inline-flex items-center gap-1.5 text-sm text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
          >
            <BedIcon className="h-4 w-4 shrink-0" />
            <span className="underline underline-offset-2">Stay</span>
          </a>
          <a
            href={deal.deepLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Book ${deal.cityTo}`}
            className="inline-flex items-center gap-1 text-sm font-medium text-black dark:text-white"
          >
            <span className="underline underline-offset-2">Book</span>
            <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
          </a>
        </div>
      </div>

      {deal.homeHoliday && (
        <div className="mt-2 flex flex-wrap items-start gap-2">
          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-sm leading-snug text-amber-900 dark:bg-amber-300/20 dark:text-amber-100">
            🎉 {deal.homeHoliday.name} · {holidayDate(deal.homeHoliday.date)} —{" "}
            {deal.ptoDays === 0
              ? "no day off needed"
              : `${deal.ptoDays} day${deal.ptoDays === 1 ? "" : "s"} off`}
          </span>
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
          {deal.destHoliday && (
            <div className="inline-flex items-center gap-2 text-black/55 dark:text-white/55">
              <span
                aria-hidden
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500 dark:bg-amber-400"
              />
              <span>
                Public holiday in {deal.cityTo} · {deal.destHoliday.name}
              </span>
            </div>
          )}
          {weatherLoading && !weather && (
            <div className="text-xs text-black/40 dark:text-white/40">
              Checking the weather…
            </div>
          )}
          {weather && (
            <div className="flex items-center gap-2 text-black/60 dark:text-white/60">
              <span aria-hidden className="text-base leading-none">
                {weather.emoji}
              </span>
              <span>
                <span className="font-medium text-black/75 dark:text-white/75">
                  {weather.mode === "forecast" ? "Expected" : "Typical"}
                </span>{" "}
                <span className="tabular-nums">
                  {weather.highC}° / {weather.lowC}°C
                </span>
                <span className="text-black/35 dark:text-white/35"> · </span>
                {weather.condition}
                {weather.mode === "forecast" &&
                  weather.precipChance != null &&
                  weather.precipChance >= 20 && (
                    <span className="text-black/45 dark:text-white/45">
                      {" · "}
                      {weather.precipChance}% rain
                    </span>
                  )}
                {weather.mode === "typical" && weather.years != null && (
                  <span className="text-black/40 dark:text-white/40">
                    {" · "}
                    {weather.years}-yr avg
                  </span>
                )}
              </span>
            </div>
          )}
          {(airlines.length > 0 || deal.bagPrice != null) && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-black/60 dark:text-white/60">
              {airlines.length > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  {airlines.slice(0, 3).map((code) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={code}
                      src={`https://images.kiwi.com/airlines/64/${code}.png`}
                      alt={airlineName(code)}
                      title={airlineName(code)}
                      width={18}
                      height={18}
                      loading="lazy"
                      className="h-[18px] w-[18px] rounded-[3px] object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                  ))}
                  {airlines.length > 3 && <span>+{airlines.length - 3}</span>}
                </span>
              )}
              {deal.bagPrice != null && (
                <span>
                  {deal.bagPrice === 0
                    ? "Checked bag included"
                    : `Cabin bag only · checked bag +${Math.round(deal.bagPrice)} ${deal.currency}`}
                </span>
              )}
            </div>
          )}
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
