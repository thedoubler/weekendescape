"use client";

import type { Deal } from "@/lib/deals";
import { calendarMonths, dealsByWeekend } from "@/lib/calendar";

// The board by WHEN. The list answers "what is cheapest"; this answers "I am
// free that weekend — where could I go", which a price-sorted column can only
// answer one row at a time.
//
// A weekend is ONE block spanning Fri–Sun, not three day cells. Three cells of
// a 7-column grid are ~48px each on a phone: enough for a number and nothing
// else, and a bare price does not say where you would be going. Spanned, the
// same weekend gets ~150px — room for a flag, a city and a fare.
//
// This is only possible because the weeks run Monday-first, which puts Fri, Sat
// and Sun adjacent at the end of every row. Sunday-first would split them.

const WD = ["M", "T", "W", "T", "F", "S", "S"];
const SPAN = ["", "col-span-1", "col-span-2", "col-span-3"];

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
    // Up to three months per row. Stacked single-file the six-month window ran
    // ~2,000px tall and answering "what about November" meant scrolling past
    // September and October; three abreast puts half a year in one screenful,
    // which is the whole argument for a calendar over a list. One column on a
    // phone, where a seven-column month needs the full width to stay legible.
    <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 xl:grid-cols-3">
      {months.map((m) =>
        !m.hasDeals ? (
          // A month inside the span with nothing in it. It keeps its heading and
          // its place in the sequence, because the confusing version was the one
          // where December was missing between November and January and the
          // reader had to guess whether that meant "empty" or "broken".
          // Deliberately not a ghost grid of thirty greyed numerals: drawing a
          // whole month to say nothing is there gives the emptiest column the
          // most ink.
          <section key={m.key} className="flex flex-col gap-1.5">
            <h3 className="text-sm font-semibold tracking-tight text-muted">
              {m.title}
            </h3>
            <p className="flex min-h-[104px] items-center justify-center rounded-lg border border-dashed border-black/12 px-3 text-center text-[12px] text-muted dark:border-white/15">
              No weekend flights this month.
            </p>
          </section>
        ) : (
        <section key={m.key} className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold tracking-tight">{m.title}</h3>
          <div className="grid grid-cols-7 gap-1">
            {WD.map((d, i) => (
              <div
                key={i}
                aria-hidden
                className="pb-0.5 text-center text-[10px] font-medium tracking-wider text-black/35 uppercase dark:text-white/35"
              >
                {d}
              </div>
            ))}
            {m.weeks.flatMap((week, wi) => {
              const out = [];
              for (let i = 0; i < 7; i++) {
                const c = week[i];
                // Mon–Thu are always plain day cells.
                if (i < 4) {
                  out.push(
                    <div
                      key={`${wi}-${i}`}
                      className="py-2 text-center text-[13px] text-black/25 tabular-nums dark:text-white/25"
                    >
                      {c.day || ""}
                    </div>
                  );
                  continue;
                }
                // Fri: decide the whole weekend here, then skip Sat and Sun.
                if (i === 4) {
                  const trio = [week[4], week[5], week[6]];
                  const real = trio.filter((x) => x.date);
                  const key = real.find((x) => x.weekend)?.weekend ?? "";
                  const trips = key ? byWeekend.get(key) : undefined;
                  if (!trips || real.length === 0) {
                    for (const [j, x] of trio.entries())
                      out.push(
                        <div
                          key={`${wi}-${4 + j}`}
                          className="py-2 text-center text-[13px] text-black/25 tabular-nums dark:text-white/25"
                        >
                          {x.day || ""}
                        </div>
                      );
                    i = 6;
                    continue;
                  }
                  const cheapest = trips[0];
                  const on = selected === key;
                  // A RANGE, not an enumeration: "12–14", never "12–13–14".
                  // The F/S/S column headers already name the days, so the
                  // middle number was pure noise — three numerals and two
                  // dashes in an 11px line that only has to say where the
                  // weekend starts and ends. A one-day sliver (a straddling
                  // weekend's orphan) still prints the bare day.
                  const days =
                    real.length > 1
                      ? `${real[0].day}–${real[real.length - 1].day}`
                      : `${real[0].day}`;
                  out.push(
                    <button
                      key={`${wi}-4`}
                      type="button"
                      aria-pressed={on}
                      onClick={() => onSelect(on ? null : key)}
                      // A weekend that straddles a month shows only the days
                      // this grid actually contains — Fri 30 + Sat 31 here, Sun
                      // 1 in the next month's first row.
                      className={`${SPAN[real.length]} flex flex-col items-start gap-0.5 rounded-lg px-2 py-1.5 text-left transition ${
                        on
                          ? "bg-neutral-900 text-white dark:bg-white dark:text-black"
                          : "bg-amber-400/15 hover:bg-amber-400/30 dark:hover:bg-amber-300/25"
                      }`}
                    >
                      <span
                        className={`text-[11px] leading-none tabular-nums ${
                          on
                            ? "opacity-70"
                            : "text-muted"
                        }`}
                      >
                        {days}
                      </span>
                      <span className="flex w-full min-w-0 items-baseline gap-1">
                        <span aria-hidden className="text-[11px] leading-none">
                          {cheapest.flag}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] leading-none font-semibold">
                          {cheapest.cityTo}
                        </span>
                        <span className="shrink-0 text-[11px] leading-none font-semibold tabular-nums">
                          {cheapest.price}
                        </span>
                      </span>
                      {/* What the one named city is hiding. Without it the
                          calendar looks like one destination per weekend. */}
                      <span
                        className={`text-[10px] leading-none ${
                          on ? "opacity-70" : "text-muted"
                        }`}
                      >
                        {trips.length > 1 ? `+${trips.length - 1} more` : " "}
                      </span>
                    </button>
                  );
                  i = 6;
                }
              }
              return out;
            })}
          </div>
        </section>
        )
      )}
      {/* Says the ONE thing the dialog header does not. The header already
          carries "Every weekend you could fly. Tap one to see all its flights",
          so the old version of this line repeated both halves and then closed
          with "Tap one to see only those trips" — an instruction left over from
          the inline calendar that filtered the board. Selection has populated
          the panel on the right since this became a dialog, so that sentence
          described behaviour the product no longer has. What is left is the
          only fact neither the header nor the blocks state: what the number on
          each block means. */}
      <p className="col-span-full text-[11px] text-muted">
        Each block shows that weekend’s cheapest destination and its fare in{" "}
        {currency}.
      </p>
    </div>
  );
}
