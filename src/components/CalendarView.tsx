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

// The weekend block's amber, as one vocabulary. The wash is the material
// ("this is a weekend you could fly"), the inset hairline is what makes it an
// object rather than a highlighter smear, and both step up together on hover.
// Dark mode keys off amber-300 rather than amber-400: the same alpha of the
// deeper hue over #14161c curdles into olive, while the lighter one stays warm.
const BLOCK_OFF =
  "bg-amber-400/15 ring-1 ring-inset ring-amber-500/25 hover:bg-amber-400/25 hover:ring-amber-500/40 dark:bg-amber-300/10 dark:ring-amber-300/20 dark:hover:bg-amber-300/15 dark:hover:ring-amber-300/35";
// Selected spends the brand orange — the only orange in the whole grid, so it
// can only mean "you are here". A 2px inset ring on a deepened wash, not a
// solid slab: the slab hid the block's own anatomy (dates went white-on-black,
// the amber material vanished) precisely on the one block the reader is
// working with. Text stays foreground on a light wash, so contrast never
// depends on the accent.
const BLOCK_ON =
  "bg-amber-400/25 ring-2 ring-inset ring-orange-600 dark:bg-amber-300/15 dark:ring-orange-400";

export function CalendarView({
  deals,
  currency,
  window,
  selected,
  onSelect,
}: {
  deals: Deal[];
  currency: string;
  /** The searched range, so empty months inside it still appear — a six-month
   *  search shows six months even where two of them found nothing. */
  window?: { from: string; to: string };
  /** Weekend key (the Saturday, ISO) currently filtered to, if any. */
  selected: string | null;
  onSelect: (weekend: string | null) => void;
}) {
  const months = calendarMonths(deals, window);
  const byWeekend = dealsByWeekend(deals);
  if (months.length === 0) return null;

  return (
    // Up to three months per row. Stacked single-file the six-month window ran
    // ~2,000px tall and answering "what about November" meant scrolling past
    // September and October; three abreast puts half a year in one screenful,
    // which is the whole argument for a calendar over a list. One column on a
    // phone, where a seven-column month needs the full width to stay legible.
    <div className="grid grid-cols-1 gap-x-10 gap-y-9 sm:grid-cols-2 xl:grid-cols-3">
      {months.map((m) => {
        // "September 2026" → the month carries the weight, the year is the
        // qualifier. Six titles at one size and one colour read as six labels;
        // splitting the pair makes them read as structure.
        const sp = m.title.lastIndexOf(" ");
        const monthName = m.title.slice(0, sp);
        const year = m.title.slice(sp + 1);
        const title = (
          <h3 className="text-[17px] leading-tight font-semibold tracking-tight">
            {monthName}{" "}
            <span className="font-normal text-muted">{year}</span>
          </h3>
        );
        return !m.hasDeals ? (
          // A month inside the span with nothing in it. It keeps its heading and
          // its place in the sequence, because the confusing version was the one
          // where December was missing between November and January and the
          // reader had to guess whether that meant "empty" or "broken".
          // Deliberately not a ghost grid of thirty greyed numerals: drawing a
          // whole month to say nothing is there gives the emptiest column the
          // most ink. Plain UI sans, same as every other status line — the
          // serif-italic version tried to make a moment of it, and an empty
          // month is not a moment, it is an answer. No border either: a dashed
          // box drew a frame around nothing; a quiet filled well holds the
          // month's place in the grid without asking to be looked at.
          <section key={m.key} className="flex flex-col gap-2">
            {title}
            <p className="flex min-h-[112px] items-center justify-center rounded-[10px] bg-black/[0.03] px-3 text-center text-[12.5px] text-muted dark:bg-white/[0.04]">
              No weekend flights this month.
            </p>
          </section>
        ) : (
          <section key={m.key} className="flex flex-col gap-2">
            {title}
            <div className="grid grid-cols-7 gap-x-1 gap-y-1.5">
              {WD.map((d, i) => (
                <div
                  key={i}
                  aria-hidden
                  className={`pb-0.5 text-center text-[10px] tracking-[0.08em] text-muted uppercase ${
                    // The three columns every block lives in, marked by weight
                    // alone — the header names the days, the bold end of the
                    // row says which of them this calendar is about.
                    i >= 4 ? "font-bold" : "font-medium"
                  }`}
                >
                  {d}
                </div>
              ))}
              {m.weeks.flatMap((week, wi) => {
                const out = [];
                for (let i = 0; i < 7; i++) {
                  const c = week[i];
                  // Mon–Thu are always plain day cells. Flex-centred so the
                  // numerals sit on the optical middle of the row their
                  // weekend block sets the height of, not at its top edge.
                  if (i < 4) {
                    out.push(
                      <div
                        key={`${wi}-${i}`}
                        className="flex items-center justify-center text-[13px] text-black/25 tabular-nums dark:text-white/25"
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
                    // A straddling weekend renders ONCE, in the month that owns
                    // its Saturday (weekendKey's anchor, chosen for exactly this
                    // reason). It used to render in both grids — the full block
                    // here AND a one-day orphan in the neighbour, a ~44px cell
                    // trying to hold a flag, a clipped city and a repeated fare,
                    // with selection ringing both. Two blocks for one bookable
                    // thing looked like two things, and the sliver looked
                    // broken. Now the other month's spill-over days are plain
                    // dim numerals, and this block's date range names the whole
                    // weekend — "30–1" across the boundary — so nothing is
                    // hidden, it is just said once.
                    const owned = key.slice(0, 7) === m.key;
                    const trips = key && owned ? byWeekend.get(key) : undefined;
                    if (!trips || real.length === 0) {
                      for (const [j, x] of trio.entries())
                        out.push(
                          <div
                            key={`${wi}-${4 + j}`}
                            className="flex items-center justify-center text-[13px] text-black/25 tabular-nums dark:text-white/25"
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
                    // The range covers the WEEKEND, not just this grid's days:
                    // Fri and Sun derived from the anchor Saturday, so a block
                    // that owns a straddler reads "30–1" rather than "30–31"
                    // with the Sunday silently elsewhere.
                    const satMs = Date.parse(key + "T00:00:00Z");
                    const fri = new Date(satMs - 86400000).getUTCDate();
                    const sun = new Date(satMs + 86400000).getUTCDate();
                    const days = fri === sun ? `${fri}` : `${fri}–${sun}`;
                    out.push(
                      <button
                        key={`${wi}-4`}
                        type="button"
                        aria-pressed={on}
                        onClick={() => onSelect(on ? null : key)}
                        // A weekend that straddles a month shows only the days
                        // this grid actually contains — Fri 30 + Sat 31 here,
                        // Sun 1 in the next month's first row.
                        className={`${SPAN[real.length]} flex flex-col items-start gap-1 rounded-[10px] px-2.5 py-2 text-left transition ${
                          on ? BLOCK_ON : BLOCK_OFF
                        }`}
                      >
                        <span
                          className={`text-[11px] leading-none tabular-nums ${
                            on
                              ? "font-semibold text-orange-700 dark:text-orange-300"
                              : "text-muted"
                          }`}
                        >
                          {days}
                        </span>
                        <span className="flex w-full min-w-0 items-baseline gap-1">
                          {/* A one-column sliver (~44px of writable width) can
                              hold a number or a flag, not both — and the fare
                              is the one that cannot truncate honestly. The
                              full block, flag included, lives in the previous
                              month's grid. */}
                          {real.length > 1 && (
                            <span
                              aria-hidden
                              className="text-[12px] leading-none"
                            >
                              {cheapest.flag}
                            </span>
                          )}
                          <span className="min-w-0 flex-1 truncate text-[13px] leading-none font-semibold tracking-tight">
                            {cheapest.cityTo}
                          </span>
                          <span className="shrink-0 text-[12.5px] leading-none font-semibold tabular-nums">
                            {cheapest.price}
                          </span>
                        </span>
                        {/* What the one named city is hiding. Without it the
                            calendar looks like one destination per weekend. */}
                        <span className="text-[10.5px] leading-none text-muted">
                          {trips.length > 1
                            ? `+${trips.length - 1} more`
                            : " "}
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
        );
      })}
      {/* Says the ONE thing the dialog header does not. The header already
          carries "Every weekend you could fly. Tap one to see all its flights",
          so the old version of this line repeated both halves and then closed
          with "Tap one to see only those trips" — an instruction left over from
          the inline calendar that filtered the board. Selection has populated
          the panel on the right since this became a dialog, so that sentence
          described behaviour the product no longer has. What is left is the
          only fact neither the header nor the blocks state: what the number on
          each block means. The swatch ties the sentence to the thing it
          explains — a key of meaning, not of counts. */}
      <p className="col-span-full flex items-center gap-2 text-[11.5px] text-muted">
        <span
          aria-hidden
          className="h-3 w-5 shrink-0 rounded-[5px] bg-amber-400/25 ring-1 ring-amber-500/40 ring-inset dark:bg-amber-300/15 dark:ring-amber-300/30"
        />
        Each block shows that weekend’s cheapest destination and its fare in{" "}
        {currency}.
      </p>
    </div>
  );
}
