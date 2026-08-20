"use client";

import type { Deal } from "@/lib/deals";
import { calendarMonths, dealsByWeekend, isTripDay } from "@/lib/calendar";

// The board by WHEN. The list answers "what is cheapest"; this answers "I am
// free that weekend — can I go anywhere", which is the question you cannot ask
// a price-sorted column without reading every row.
//
// A whole Fri–Sun run lights as one block rather than three days, because the
// unit here is the weekend, not the day: you cannot take Saturday only.

const WD = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarView({
  deals,
  currency,
  selected,
  onSelect,
}: {
  deals: Deal[];
  currency: string;
  /** Weekend key (the Saturday, ISO) currently filtered to, if any. */
  selected: string | null;
  onSelect: (weekend: string | null) => void;
}) {
  const months = calendarMonths(deals);
  const byWeekend = dealsByWeekend(deals);
  if (months.length === 0) return null;

  return (
    <div className="flex flex-col gap-5">
      {months.map((m) => (
        <section key={m.key} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold tracking-tight">{m.title}</h3>
          <div
            className="grid grid-cols-7 gap-0.5 text-center"
            role="grid"
            aria-label={m.title}
          >
            {WD.map((d, i) => (
              <div
                key={i}
                aria-hidden
                className="pb-1 text-[10px] font-medium tracking-wider text-black/35 uppercase dark:text-white/35"
              >
                {d}
              </div>
            ))}
            {m.weeks.flat().map((c, i) => {
              // isTripDay, not just "the weekend has deals": every weekday
              // maps to a weekend, so without it Wednesday lit up too.
              const trips =
                c.date && isTripDay(c.date) ? byWeekend.get(c.weekend) : undefined;
              // Empty pad cell, or a weekday with nothing to offer.
              if (!c.date || !trips) {
                return (
                  <div
                    key={i}
                    className="py-1.5 text-[13px] text-black/25 tabular-nums dark:text-white/25"
                  >
                    {c.day || ""}
                  </div>
                );
              }
              const cheapest = trips[0];
              const isSat = new Date(c.date + "T00:00:00Z").getUTCDay() === 6;
              const on = selected === c.weekend;
              return (
                <button
                  key={i}
                  type="button"
                  aria-pressed={on}
                  // The accessible name carries what the visual cell cannot: a
                  // sighted user reads the price off the Saturday and infers
                  // the run; a screen reader gets each day on its own.
                  aria-label={`${c.day} — ${trips.length} ${
                    trips.length === 1 ? "trip" : "trips"
                  }, from ${cheapest.price} ${currency}, cheapest ${cheapest.cityTo}`}
                  onClick={() => onSelect(on ? null : c.weekend)}
                  className={`flex flex-col items-center justify-center rounded-md py-1 transition ${
                    on
                      ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                      : "bg-amber-400/15 text-black/80 hover:bg-amber-400/30 dark:text-white/80 dark:hover:bg-amber-300/25"
                  }`}
                >
                  <span className="text-[13px] leading-none font-semibold tabular-nums">
                    {c.day}
                  </span>
                  {/* The price rides on the Saturday only. Printed on all three
                      days it read as three different fares for one trip; the
                      whole run is tinted, so the block already says which days
                      the number covers. */}
                  <span
                    aria-hidden
                    className={`mt-0.5 text-[9px] leading-none tabular-nums ${
                      isSat ? "" : "invisible"
                    } ${on ? "opacity-80" : "text-black/55 dark:text-white/55"}`}
                  >
                    {cheapest.price}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
      <p className="text-[11px] text-black/50 dark:text-white/50">
        Tinted days have flights. The figure is the cheapest fare that weekend,
        in {currency} — tap to see only those trips.
      </p>
    </div>
  );
}
