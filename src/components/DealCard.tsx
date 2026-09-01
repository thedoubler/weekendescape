"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { type Deal, isBridge, dealDomId } from "@/lib/deals";
import { type WeatherResult, packingCue } from "@/lib/weather";

import type { WeekendStyle } from "@/lib/weekend";
import { CheapestWeekend } from "@/components/CheapestWeekend";
import ThingsToDo from "@/components/ThingsToDo";
import PlaceLinks from "@/components/PlaceLinks";
import {
  timeLabel,
  durationLabel,
  dayBlocks,
  crossesMidnight,
  isNightHour,
  holidayDate,
  holidaySearchUrl,
  stopsSummary,
  dateWithMonth,
  weekendRange,
  weekendWhen,
} from "@/lib/format";
import { hotelUrl } from "@/lib/hotels";
import { airlineName } from "@/lib/airlines";
import { baggageInfo } from "@/lib/baggage";
import { legAirMinutes, layoverFlags, costRows } from "@/lib/trip-facts";
import { legSummary, type LegInput } from "@/lib/leg-summary";
import { daylightNote } from "@/lib/daylight";
import { DayBlocks } from "@/components/DayBlocks";

// Below this the airport is "in town" enough not to warrant a caveat; above it
// (Charleroi/Brussels, Beauvais/Paris…) the transfer is worth surfacing.
const FAR_AIRPORT_KM = 30;
function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </h4>
  );
}

function Leg(props: LegInput & { hideDirect?: boolean }) {
  const { depTime, arrTime, meta, spoken } = legSummary(props);
  // "2h 45m · direct" on every leg of a direct-only board says "direct"
  // twice per card about a fact the search guarantees — stripped here, the
  // right cell is just the duration and the row finally reads in one pass.
  // The SPOKEN sentence keeps the word: a screen-reader user hears each leg
  // without the board's context. Legs with stops always show them.
  const shownMeta =
    props.hideDirect && props.stops === 0 ? meta.replace(" · direct", "") : meta;
  return (
    <li className="col-span-3 grid grid-cols-subgrid items-baseline gap-y-0.5">
      {/* One sentence for assistive tech, in decision order. The visual row is
          hidden from it: read literally it is a pile of orphan fragments with
          the duration wedged between the two times. */}
      <span className="sr-only">{spoken}</span>
      <span aria-hidden className="contents">
        <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {props.label}
        </span>
        <span className="flex items-baseline gap-1.5">
          <time
            dateTime={props.depIso}
            className="text-[15px] font-semibold tabular-nums"
          >
            {depTime}
          </time>
          {/* The home airport carries the information now that the board can
              search three of them; the destination code is already the card's
              headline, so it stays muted. */}
          <span className="text-xs font-medium text-black/70 dark:text-white/70">
            {props.depCode}
          </span>
          <span className="text-black/30 dark:text-white/30">→</span>
          <time
            dateTime={props.arrIso}
            className="text-[15px] font-semibold tabular-nums"
          >
            {arrTime}
            {props.plusOne && (
              <span className="align-super text-[10px] font-medium text-muted-foreground">
                +1
              </span>
            )}
          </time>
          <span className="text-xs text-muted-foreground">
            {props.arrCode}
          </span>
        </span>
        {/* Right column: duration and stops, right-aligned so both legs'
            durations share an edge. Never truncated — on a multi-stop trip
            this run is the only text that says the journey is complicated. */}
        <span className="justify-self-end text-right text-[11px] text-muted-foreground tabular-nums">
          {shownMeta}
        </span>
        {/* Logos live here, not on the collapsed card: a couple of requests per
            opened card rather than ~78 across a whole board, and at 16px beside
            15px times they finally sit at a size worth rendering. */}
        {props.carriers.length > 0 && (
          /* Second line, aligned under the times column — the carrier is meta,
             not part of the time comparison. */
          <span className="col-start-2 col-span-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            {props.carriers.map((c) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={c.code}
                src={`https://images.kiwi.com/airlines/64/${c.code}.png`}
                // Decorative — the name follows as text, so alt would make a
                // screen reader announce every carrier twice.
                alt=""
                width={16}
                height={16}
                loading="lazy"
                className="h-4 w-4 rounded-[3px] object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
              />
            ))}
            <span>{props.carriers.map((c) => c.name).join(", ")}</span>
          </span>
        )}
      </span>
    </li>
  );
}

// Inline icons (Lucide, currentColor) so the Stay/Book actions render
// consistently across platforms and adapt to light/dark — unlike emoji.

function MapPinIcon({ className }: { className?: string }) {
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
      <path d="M20 10c0 4.4-8 12-8 12s-8-7.6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
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
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
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
  focusSeq,
  showOrigin = false,
  onHover,
  idPrefix = "",
  hideStops = false,
  hideDays = false,
}: {
  deal: Deal;
  cheapest?: { style: WeekendStyle; months: number; direct: boolean; adults: number };
  // Bumped by the map when this card's destination pin is tapped.
  focusSeq?: number;
  // Reports this deal's destination while the pointer is over the card, so the
  // map can lift its arc out of the fan. Pointer/focus only — never on tap,
  // where there is no hover and the highlight would be a lie.
  onHover?: (flyTo: string | null) => void;
  // True when the board is searching more than one home airport.
  showOrigin?: boolean;
  /** Prefixes the card's DOM ids. The Dates dialog renders the SAME deal as
   *  the board does, and ids must stay unique across the document — without
   *  this, getElementById for a map jump could land on the dialog's copy. */
  idPrefix?: string;
  /** True when the SEARCH is direct-only: every card would say "Direct", and
   *  a fact shared by all results belongs to the receipt line, not to each
   *  card. A connecting trip still prints its stops even with this set —
   *  that would be the one card where the word carries information. */
  hideStops?: boolean;
  /** Drop the Fri/Sat/Sun strip. The origin pages want the quiet version of the
   *  card — dates, price and the booking hand-off — because they are read, not
   *  operated, and 23 day strips in a column is a lot of furniture for a page
   *  whose job is to be scanned. */
  hideDays?: boolean;
}) {
  const [open, setOpen] = useState(false);
  // Real per-flight emissions, fetched on first expand. Null until it lands, or
  // for good if the model has no data for these flights.
  const [timGrams, setTimGrams] = useState<number | null>(null);

  // Open on request from the map. Adjusting during render rather than in an
  // effect so the card is already expanded when the caller scrolls it into
  // view — an effect would centre on the collapsed height, then grow.
  const [seenSeq, setSeenSeq] = useState(focusSeq);
  if (focusSeq !== seenSeq) {
    setSeenSeq(focusSeq);
    if (focusSeq !== undefined) setOpen(true);
  }
  const [weather, setWeather] = useState<WeatherResult | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // Weather is fetched lazily the first time a card is expanded, so the list
  // view stays free of per-destination network calls.
  const weatherTried = useRef(false);
  const emissionsTried = useRef(false);

  // Same shape as the weather fetch above: once, on first expand, so the board
  // never makes a per-destination call for cards nobody opened.
  useEffect(() => {
    if (!open || emissionsTried.current) return;
    if (!deal.segments || deal.segments.length === 0) return;
    emissionsTried.current = true;
    let alive = true;
    fetch("/api/emissions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ segments: deal.segments }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && typeof d?.grams === "number") setTimGrams(d.grams);
      })
      // Silent: the estimate below is a perfectly good fallback, and a failed
      // CO2 lookup is not worth an error state on a booking panel.
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [open, deal.segments]);

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
  const adults = cheapest?.adults ?? 1;
  const bags = baggageInfo(deal, adults);
  // Astronomy, so it needs no caveat — but it only earns a row when daylight
  // actually constrains the trip. Silence is the signal the rest of the time.
  const daylight =
    deal.destUtcOffsetMin != null
      ? daylightNote(deal.toCoords, deal.outArrive, deal.destUtcOffsetMin)
      : null;
  const panelId = `${idPrefix}deal-panel-${deal.flyTo}-${deal.outDepart.slice(0, 10)}`;
  const flags = layoverFlags(deal);
  const cost = costRows(deal, adults);
  const arrival = {
    time: timeLabel(deal.outArrive),
    night: isNightHour(deal.outArrive),
    plusOne: crossesMidnight(deal.outDepart, deal.outArrive),
  };
  const departure = {
    time: timeLabel(deal.backDepart),
    night: isNightHour(deal.backDepart),
  };
  // The two flight legs, for the day-strip hover. These carry the one fact the
  // strip cannot: when you leave home and when you get back, which differ from
  // the first and last cells whenever the itinerary crosses midnight.
  const legs = {
    arrive: `Leaves ${deal.cityFrom} ${dateWithMonth(deal.outDepart)} ${timeLabel(
      deal.outDepart
    )} · lands ${timeLabel(deal.outArrive)}`,
    leave: `Leaves ${deal.cityTo} ${timeLabel(deal.backDepart)} · home ${dateWithMonth(
      deal.backArrive
    )} ${timeLabel(deal.backArrive)}`,
  };
  const returnPlusOne = crossesMidnight(deal.backDepart, deal.backArrive);
  const direct = deal.outStops === 0 && deal.backStops === 0;
  const stops = stopsSummary(deal.outStops, deal.backStops);

  return (
    <div
      id={idPrefix + dealDomId(deal)}
      style={
        open
          ? { boxShadow: "0 12px 28px -12px rgba(0,0,0,0.28)" }
          : undefined
      }
      onMouseEnter={() => onHover?.(deal.flyTo)}
      onMouseLeave={() => onHover?.(null)}
      // Keyboard parity: tabbing through the board drives the same highlight.
      onFocus={() => onHover?.(deal.flyTo)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onHover?.(null);
      }}
      // scroll-margin so the map's scroll-into-view doesn't tuck the card under
      // the sticky month divider.
      // Open cards lift off the page. Without it a ~900px panel shares a flat
      // background with its neighbours and reads as more list, not as a layer.
      // Deliberately restrained: too much and the 60 collapsed cards around it
      // look sunken by comparison.
      // @container/card: the card renders at two real widths — ~816px on the
      // board, ~396px inside the Dates dialog — and both can occur on the SAME
      // desktop viewport, so viewport breakpoints (sm:) are the wrong axis for
      // anything inside it. Every width-adaptive style below keys off this
      // container instead.
      className={`@container/card group relative scroll-mt-[calc(var(--list-sticky-top,4rem)+0.75rem)] overflow-hidden rounded-xl border p-4 transition duration-200 motion-safe:hover:-translate-y-0.5 ${
        open
          ? "border-black/15 bg-white dark:border-white/20 dark:bg-white/[0.04]"
          : "border-black/[0.14] shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-black/25 hover:shadow-md dark:border-white/[0.14] dark:shadow-none dark:hover:border-white/25"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
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
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">
                  {deal.countryTo}
                </span>
              )}
            </span>
          </div>
          <div className="mt-0.5 text-xs">
            <span className="font-medium text-black/70 dark:text-white/70">
              {/* The coarse "when", because that is the decision at the browse
                  stage — the exact days are in the strip directly below, with
                  the flight times that make them mean something.

                  Reads outDepart, never outArrive. Those differ by a day on an
                  overnight leg, and this header used to print the arrival day:
                  the Istanbul card said "Sat 7 – Sun 8 Nov" for a flight
                  leaving Cluj Fri 6 Nov at 21:25. Measured on the live board,
                  the departure day was wrong on 1/14 direct results and 17/69
                  with stops allowed. */}
              {weekendWhen(deal.outDepart, new Date())}
              {/* Assistive-tech users cannot glance down at the strip, so the
                  exact range is still announced here — only the visible glyphs
                  moved. */}
              <span className="sr-only">
                , {weekendRange(deal.outDepart, deal.backArrive)}
              </span>
            </span>
            {!(hideStops && direct) && (
              <>
                <span className="text-black/35 dark:text-white/35"> · </span>
                <span
                  className={
                    direct
                      ? "text-muted-foreground"
                      : "font-medium text-black/70 dark:text-white/70"
                  }
                >
                  {stops}
                </span>
              </>
            )}
            {/* With several home airports a bare price is ambiguous — which one
                does this leave from? Only shown when it's actually in question. */}
            {showOrigin && (
              <>
                <span className="text-black/35 dark:text-white/35"> · </span>
                <span className="font-medium text-black/70 dark:text-white/70">
                  from {deal.flyFrom}
                </span>
              </>
            )}
          </div>
        </button>
        <div className="shrink-0 text-right">
          {/* tabular-nums: Space Grotesk's proportional digits make a 60-row
              price column jitter by ~6px, on the one figure the whole board is
              sorted by. */}
          <div className="text-lg font-semibold tabular-nums">
            {deal.price} {deal.currency}
          </div>
          {/* Kiwi prices the whole party — flag it for groups so the total
              isn't read as per-person (the CO₂ line in details is per-person). */}
          {adults > 1 && (
            <div className="text-[11px] text-muted-foreground">
              {adults} travellers
            </div>
          )}
          {/* "in 169 days" is gone: the header now carries the when, and both
              sides of the date debate agreed this was the duplicate to cut. It
              was derived arithmetic sitting in the price column the whole board
              is sorted by, on a board whose median result is 57 days out. */}
        </div>
        {/* The disclosure lives at the trailing edge of the header, where an
            accordion's control is expected — the card previously had two
            silently-clickable regions and a control down in the footer, which
            is not where anyone looks to find out if a row opens. */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? `Hide details for ${deal.cityTo}` : `Show details for ${deal.cityTo}`}
          className="-mr-1 flex h-11 w-8 shrink-0 items-center justify-center self-start rounded-lg text-muted-foreground transition hover:bg-black/[0.05] hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
        >
          <ChevronIcon
            className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </div>

      {!hideDays && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={open ? "Hide details" : "Show details"}
          className="mt-3 block w-full text-left"
        >
          <DayBlocks
            cells={cells}
            arrival={arrival}
            departure={departure}
            holiday={deal.destHoliday}
            cityTo={deal.cityTo}
            homeHolidays={deal.homeHolidays}
            daysOff={deal.ptoDates}
            legs={legs}
          />
        </button>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Neutral ink, by request — this was green when the stay cleared
              36h, but over the flag wash a green sentence read as belonging
              to the flag, not to the card. One colour regardless of stay
              length; the duration itself still carries the judgement.
              /55 in light mode: at /70 it was the blackest small text on a
              pastel-washed card and read as odd emphasis. Dark stays white. */}
          <span className="text-sm text-black/55 dark:text-white">
            <span className="font-medium">{stay}</span> to explore
          </span>
        </div>
        {/* Visible in BOTH card states — restored by request after a
            collapsed-only version shipped briefly. Yes, "Book flight" here
            and "Book on Kiwi" in the open panel are the same action twice;
            the counter-argument that won is consistency — these two links
            live at this spot on every card on the board, and links that
            vanish when a card opens read as taken away. */}
        <div className="flex items-center gap-3">
            <a
              href={hotelUrl(deal, adults)}
              target="_blank"
              rel="noopener noreferrer sponsored"
              aria-label={`Find a hotel in ${deal.cityTo} on Booking.com (opens a new tab)`}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-black transition duration-200 dark:text-white"
            >
              <span className="underline underline-offset-2">Hotels</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
            </a>
            <a
              href={deal.deepLink}
              target="_blank"
              rel="noopener noreferrer sponsored"
              aria-label={`Book ${deal.cityTo} on Kiwi.com (opens a new tab)`}
              className="inline-flex items-center gap-1 text-sm font-medium text-black transition duration-200 dark:text-white"
            >
              <span className="underline underline-offset-2">Book flight</span>
              <ExternalLinkIcon className="h-3.5 w-3.5 shrink-0" />
            </a>
          </div>
      </div>

      {isBridge(deal) && deal.homeHoliday && (
        // Two lines, not one sentence. This used to run "Long weekend · no day
        // off needed — you're off for St. Andrew's Day & National Day/Great
        // Union · Mon 30 Nov" across a single line: three facts of different
        // importance, separated by identical dots, so nothing led. Now the
        // claim and its cost sit on top, the evidence underneath.
        //
        // No left rule: the 🌉 already marks the block, and a second vertical
        // marker beside it was two devices doing one job.
        <div className="mt-2.5 flex items-start gap-2.5 py-0.5 text-sm leading-snug text-amber-900 dark:text-amber-100/90">
          <span aria-hidden className="mt-[3px] shrink-0 text-[13px] leading-none">
            🌉
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-semibold">
                {(deal.ptoDays ?? 0) <= 1 ? "Long weekend" : "Bridge trip"}
              </span>
              {/* The cost in leave is the whole point, so it gets the badge —
                  same vocabulary the planned bridge strip uses. */}
              <span className="rounded-full bg-amber-400/20 px-2 py-[1px] text-[11px] font-semibold tracking-wide text-amber-900 dark:bg-amber-300/20 dark:text-amber-100">
                {deal.ptoDays === 0
                  ? "no day off"
                  : deal.ptoDays === 1
                    ? "1 day off"
                    : `${deal.ptoDays} days off`}
              </span>
            </div>
            <div className="text-amber-900/70 dark:text-amber-100/70">
              {(() => {
                const hols = deal.homeHolidays?.length
                  ? deal.homeHolidays
                  : deal.homeHoliday
                    ? [deal.homeHoliday]
                    : [];
                const names = hols.map((h) => h.name);
                const joined =
                  names.length <= 1
                    ? (names[0] ?? "")
                    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
                // Date first: it is the actionable half. The holiday's name
                // explains WHY, and can be very long in some countries.
                return `${holidayDate(hols[0].date)} is a holiday — ${joined}`;
              })()}
            </div>
          </div>
        </div>
      )}

      {open && (
        <div
          id={panelId}
          // One column at every width, costs underneath the itinerary — by
          // request. A two-column split (itinerary left, cost rail right, per
          // Google Flights) shipped briefly and was rolled back: the vertical
          // read — trip first, then money, then the button — is the order the
          // decision actually happens in. The receipt cap and self-sizing CTA
          // below are what keep the costs section from sprawling at full
          // panel width.
          //
          // Hairline discipline stands: the panel's top rule and the cost
          // section's own rule are the only internal separators; labels and
          // whitespace do the rest.
          className="mt-3 flex flex-col gap-4 border-t border-black/[0.07] pt-3 text-sm dark:border-white/10"
        >
          {/* The panel answers three unrelated questions — how do I get there,
              what is it like there, what does it cost — in that order, top to
              bottom. */}
          <div className="flex min-w-0 flex-col gap-5">
          <section className="flex flex-col gap-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <SectionLabel>The flights</SectionLabel>
              {showOrigin && deal.cityFrom && (
                <span className="text-[10px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
                  From {deal.cityFrom} ({deal.flyFrom})
                </span>
              )}
            </div>
            {/* A grid, not a wrap: Out and Back share column edges, so the
                eye can drop vertically to compare times — which is the actual
                task here. Wrapped flex put the duration and carrier at
                arbitrary x positions on every card. */}
            <ul className="grid grid-cols-[2.25rem_1fr_auto] gap-x-2 gap-y-2">
            <Leg
              label="Out"
              depIso={deal.outDepart}
              arrIso={deal.outArrive}
              depCode={deal.flyFrom}
              arrCode={deal.flyTo}
              depCity={deal.cityFrom}
              arrCity={deal.cityTo}
              plusOne={arrival.plusOne}
              minutes={legAirMinutes(
                deal.outDurationMin,
                deal.outDepart,
                deal.outArrive
              )}
              stops={deal.outStops}
              layovers={deal.outLayovers}
              hideDirect={hideStops}
              carriers={(deal.outAirlines ?? []).map((code) => ({
                code,
                name: airlineName(code),
              }))}
            />
            <Leg
              label="Back"
              depIso={deal.backDepart}
              arrIso={deal.backArrive}
              depCode={deal.flyTo}
              arrCode={deal.flyFrom}
              depCity={deal.cityTo}
              arrCity={deal.cityFrom}
              plusOne={returnPlusOne}
              minutes={legAirMinutes(
                deal.backDurationMin,
                deal.backDepart,
                deal.backArrive
              )}
              stops={deal.backStops}
              layovers={deal.backLayovers}
              hideDirect={hideStops}
              carriers={(deal.backAirlines ?? []).map((code) => ({
                code,
                name: airlineName(code),
              }))}
            />
            </ul>


            {/* Conditional warnings only. Most trips show none, which is what
                makes their absence meaningful and their presence worth reading. */}
            {flags.map((f) => (
              <p
                key={`${f.at}-${f.minutes}-${f.kind}`}
                className="flex items-start gap-1.5 text-[13px] text-amber-700 dark:text-amber-400"
              >
                <span aria-hidden className="mt-[1px] shrink-0">
                  ⚑
                </span>
                <span>
                  {f.kind === "tight"
                    ? `Tight connection — ${durationLabel(f.minutes)} in ${f.at}, little room if anything slips.`
                    : `Long stop — ${durationLabel(f.minutes)} in ${f.at}.`}
                </span>
              </p>
            ))}

            {/* Moved from the collapsed header, by request — it is a detail
                about the flight, so it lives with the flights. Still only
                when the airport is genuinely far (>= FAR_AIRPORT_KM): at 5 km
                nobody cares that Nuremberg's airport calls itself Nürnberg.
                Names the PLACE, not just the distance — "you land in
                Charleroi" is actionable where "44 km from Brussels" is only a
                complaint. Neutral, not amber: amber is spent on warnings with
                a decision attached. */}
            {deal.airportKmFromCity != null &&
              deal.airportKmFromCity >= FAR_AIRPORT_KM && (
                <p className="inline-flex items-start gap-1.5 text-[13px] text-muted-foreground">
                  <span aria-hidden>✈</span>
                  <span>
                    {deal.airportCity
                      ? `You land in ${deal.airportCity} — ${deal.airportKmFromCity} km from ${deal.cityTo}`
                      : `Airport ${deal.airportKmFromCity} km from ${deal.cityTo}`}
                  </span>
                </p>
              )}
          </section>

          <section className="flex flex-col gap-2">
            {/* The heading row carries the see-the-place links: the section is
                already "what is it like there", and the icons sit in the dead
                space at its trailing edge rather than costing a row. Hotels
                briefly lived here too and went back to the card footer — by
                request; the footer is where every card offers it, open or
                not, and muscle memory beats taxonomy. */}
            <div className="-my-1 flex items-center justify-between gap-2">
              <SectionLabel>In {deal.cityTo}</SectionLabel>
              <PlaceLinks city={deal.cityTo} country={deal.countryTo} />
            </div>
          {weatherLoading && !weather && (
            // Two bars: the resolved row is always two lines, so a one-line
            // skeleton would still reflow the panel when it lands.
            <div className="flex flex-col gap-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-black/[0.06] dark:bg-white/[0.08]" />
            </div>
          )}
          {weather && (
            <div className="flex items-center gap-2 text-muted-foreground">
              {/* Full-strength ink for the glyph. This started as a fix for a
                  specific bug — the row's colour was `text-black/60`, and an
                  alpha sets a 60% -webkit-text-fill-color that browsers apply
                  to the colour glyph itself, washing the emoji out. The row now
                  takes the solid `text-muted-foreground` token, which has no alpha to
                  bleed, so that bug is gone; the override stays because a
                  weather glyph should read at full strength regardless of what
                  colour the line around it happens to be. */}
              <span
                aria-hidden
                className="text-base leading-none text-black dark:text-white"
              >
                {weather.emoji}
              </span>
              <span>
                <span className="font-semibold tabular-nums text-black dark:text-white">
                  {weather.highC}° / {weather.lowC}°C
                </span>
                <span className="text-black/35 dark:text-white/35"> · </span>
                {weather.condition}
                {weather.mode === "forecast" &&
                  weather.precipChance != null &&
                  weather.precipChance >= 20 && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {weather.precipChance}% rain
                    </span>
                  )}
                {packingCue(weather) && (
                  <span className="text-muted-foreground">
                    {" — "}
                    {packingCue(weather)}
                  </span>
                )}
                {/* The methodology caveat is demoted to its own quiet line
                    rather than interrupting the primary statement mid-sentence. */}
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {weather.mode === "forecast"
                    ? "Forecast for these dates"
                    : `Typical for these dates · ${weather.years ?? 5}-year average`}
                </span>
              </span>
            </div>
          )}
          {daylight && (
            <div className="inline-flex items-start gap-2 text-black/70 dark:text-white/70">
              <SunIcon className="mt-[2px] h-4 w-4 shrink-0 text-amber-500" />
              <span>{daylight}</span>
            </div>
          )}
          {deal.destHoliday && (
            // Reframed: a public holiday at the destination usually means the
            // shops are shut. The old copy styled it as a perk, which sold a
            // downside as an upside.
            <div className="inline-flex items-start gap-2 text-black/70 dark:text-white/70">
              {/* Only the pin carries the accent. Colouring the whole sentence
                  made a caveat read as a highlight, and spent an accent colour
                  on a row that isn't the most important thing in the panel. */}
              <MapPinIcon className="mt-[2px] h-4 w-4 shrink-0 text-teal-700 dark:text-teal-400" />
              <span>
                <a
                  href={holidaySearchUrl(
                    deal.destHoliday.name,
                    deal.cityTo,
                    deal.destHoliday.date
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Search the web for ${deal.destHoliday.name} in ${deal.cityTo} (opens a new tab)`}
                  className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
                >
                  {deal.destHoliday.name}
                  <ExternalLinkIcon className="ml-1 inline h-3 w-3 align-[-0.1em]" />
                </a>{" "}
                {" — "}
                {deal.destHoliday.national === false
                  ? `a public holiday in parts of ${deal.countryTo || "the country"}`
                  : `a public holiday in ${deal.cityTo}`}
                ; opening hours may differ.
              </span>
            </div>
          )}
          </section>
          </div>

          <section className="flex min-w-0 flex-col gap-2 border-t border-black/[0.07] pt-3 dark:border-white/10">
            <SectionLabel>What it costs</SectionLabel>
            {/* A table, not a sentence. The bag fee runs ~85% of the fare at the
                median on this board, so the headline price is roughly half the
                real number — that comparison has to be legible at a glance. */}
            {/* Full width, label left and number hard right — by request. A
                19rem cap shipped briefly (the dialog's stretched receipt) and
                was rolled back in favour of the classic receipt read across
                the whole panel. */}
            <dl className="flex flex-col gap-1">
              {cost.map((row) => (
                <div
                  key={row.label}
                  className={`flex items-baseline justify-between gap-3 ${
                    row.total
                      ? "mt-1 border-t border-black/[0.07] pt-1.5 dark:border-white/10"
                      : ""
                  }`}
                >
                  {/* No bold, no amber, by request. The total row used to be
                      15px semibold and a severe bag fee turned its value
                      amber; both shouted inside a three-row table. What marks
                      the total now is what receipts actually use: the rule
                      above it and full-ink text against the muted rows. The
                      bag fee's size relative to the fare is legible from the
                      numbers themselves. */}
                  <dt
                    className={
                      row.total
                        ? "text-black dark:text-white"
                        : "text-black/65 dark:text-white/65"
                    }
                  >
                    {row.label}
                  </dt>
                  <dd
                    // nowrap: in the 15rem rail the long total label ("With
                    // one checked bag") squeezed "114 EUR" onto two lines.
                    // Numbers never break; labels may.
                    className={`whitespace-nowrap tabular-nums ${
                      row.total
                        ? "text-black dark:text-white"
                        : "text-black/65 dark:text-white/65"
                    }`}
                  >
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            {/* Only when the table couldn't state a total — then this carries
                real information (unknown price, two airlines, a party). When
                there IS a total row it just repeats the number above it. */}
            {!cost.some((r) => r.total) && (
              <p className="text-[11px] text-muted-foreground">
                {bags.full}
              </p>
            )}

            {/* Full-width CTA at the foot of the panel. The header Book link
                scrolls off-screen on a phone once the card is open, so the user
                read all of this and then had to scroll back up to act. */}
            <a
              href={deal.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Book ${deal.cityTo} on Kiwi.com (opens a new tab)`}
              // Full-bleed only on a TRUE phone-width card (content < 336px —
              // see the receipt cap above for why that number), where it is
              // the thumb target at the foot of a long panel. Above it — the
              // 420px dialog included — it sizes to its label: a full-width
              // black bar in a desktop dialog read as stretched, and a
              // pointer does not need the width a thumb does.
              className="mt-1 inline-flex min-h-11 w-full items-center justify-center gap-1.5 self-start rounded-full bg-neutral-900 px-5 text-sm font-medium text-white transition hover:bg-neutral-800 @min-[336px]/card:w-auto dark:bg-white dark:text-black dark:hover:bg-neutral-200"
            >
              Book on Kiwi
              <ExternalLinkIcon className="h-3.5 w-3.5" />
            </a>

            {/* One footnote instead of three trailing caveats, each of which
                diluted its own row. Absorbs the CO₂ figure, which was a
                colour-coded row for a number nobody books on. */}
            {/* Two unrelated facts, so two lines. They were joined by a "·",
                which read as one run-on sentence and buried the CO₂ figure at
                the tail of a caveat about pricing. */}
            {/* BELOW the CTA. It resolves after the panel opens, so anywhere
                above the button meant the button moved under a thumb already
                reaching for it — reserving a slot instead just moved the jump
                to when the slot collapsed. Nothing that arrives late may sit
                above the primary action. */}
            {/* Separated from the CTA above it. Sitting flush under the Book
                button, a second date and a second price read as part of the
                same block — they are a different offer for a different weekend. */}
            {cheapest && (
              <CheapestWeekend
                flyFrom={deal.flyFrom}
                flyTo={deal.flyTo}
                cityTo={deal.cityTo}
                current={deal}
                style={cheapest.style}
                months={cheapest.months}
                direct={cheapest.direct}
                adults={cheapest.adults}
              />
            )}
            <div className="flex flex-col gap-0.5 text-[11px] text-muted-foreground">
              <p>Final price, bags and cabin rules are set on Kiwi.</p>
              {/* Google's Travel Impact Model when it knows the aircraft, our
                  own distance estimate otherwise. The two are not close: on a
                  Cluj-Bergamo return TIM says ~181 kg against our ~335 kg, so
                  labelling matters — "measured" and "estimate" are different
                  claims and the line says which one you are reading. */}
              {timGrams != null ? (
                <p>
                  {Math.round(timGrams / 1000)} kg CO₂ per person ·{" "}
                  <a
                    href="https://github.com/google/travel-impact-model"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2"
                  >
                    Google Travel Impact Model
                  </a>
                </p>
              ) : (
                deal.co2Kg != null && (
                  <p>~{deal.co2Kg} kg CO₂ per person (estimate)</p>
                )
              )}
            </div>
          </section>
          {/* Last thing in the panel, and behind one more click: it is an
              upsell, not a reason the card exists, and it must not interrupt
              the cost read. Renders nothing when GYG has no inventory. */}
          <ThingsToDo city={deal.cityTo} />
        </div>
      )}
    </div>
  );
}
