"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";
import { dealsByWeekend } from "@/lib/calendar";
import { weekendRange } from "@/lib/format";
import { CalendarView } from "@/components/CalendarView";
import { DealCard } from "@/components/DealCard";

// The calendar as a FULLSCREEN dialog, not an inline section.
//
// Inline, the calendar had two problems it could not grow out of. It fought
// the board for the same column — six month grids pushed the deals ~2,000px
// down — and a weekend block had exactly one line of room, so "+4 more" was
// all it could say about a Saturday with five flights on it. The whole point
// of the view is "I'm free that weekend, what are my options", and it could
// not show the options.
//
// Fullscreen buys the second panel that fixes that: the calendar keeps the
// left side, and the selected weekend's flights get a column of their own —
// every one of them, not a "+N more" hint. Same split as the references this
// page is measured against (Google Flights: grid left, results right).
//
// A real <dialog> for the same reasons OriginSheet is one: Escape, focus
// containment, inert page behind, top-layer — all free, all correct.
//
// Selection is LOCAL to the dialog. The old inline calendar wrote its picked
// weekend into the board's filter state, which was fine while the calendar
// stayed visible next to the filtered board. From a dialog that closes, the
// same write would leave the board silently filtered by a control that is no
// longer on screen — filter state with no visible representation. Closing
// the dialog leaves the board exactly as it was.
//
// The panel renders the board's own DealCard, not a summary row. A first
// version drew compact rows that closed the dialog and jumped the board to
// the matching card — same data, drawn twice, plus a teleport to connect
// them. The card already knows how to be small when closed and complete when
// open (flights, weather, bags, Book on Kiwi), so the panel uses it as-is
// and everything happens in place. `idPrefix` keeps its DOM ids from
// colliding with the same card on the board behind the dialog.

export function CalendarDialog({
  open,
  deals,
  currency,
  onClose,
  hideStops,
}: {
  open: boolean;
  deals: Deal[];
  currency: string;
  onClose: () => void;
  /** See DealCard.hideStops. */
  hideStops?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.open = true;
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.open = false;
    }
  }, [open]);

  const byWeekend = useMemo(() => dealsByWeekend(deals), [deals]);
  // ISO keys compare lexically, so min() is the earliest weekend with deals —
  // the default selection. The panel is never empty on open: opening to "pick
  // something first" wastes the reader's first glance, and the earliest
  // weekend is the one "I'm free, where could I go" most often means.
  const defaultKey = useMemo(() => {
    let min: string | null = null;
    for (const k of byWeekend.keys()) if (min === null || k < min) min = k;
    return min;
  }, [byWeekend]);
  const shownKey = selected ?? defaultKey;
  const trips = shownKey ? (byWeekend.get(shownKey) ?? []) : [];
  const first = trips[0];

  return (
    <dialog
      ref={ref}
      onClose={() => {
        // Selection dies with the dialog, so reopening starts predictable —
        // at the earliest weekend — rather than wherever a previous visit
        // happened to end.
        setSelected(null);
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-0 h-dvh max-h-none w-screen max-w-none rounded-none border-0 bg-white p-0 text-black backdrop:bg-black/45 dark:bg-[#14161c] dark:text-white"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-black/[0.07] px-4 py-3 sm:px-6 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Calendar</h2>
            <p className="text-[12.5px] text-black/55 dark:text-white/55">
              Every weekend you could fly. Tap one to see all its flights.
            </p>
          </div>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="-m-2 shrink-0 rounded-full p-2 text-xl leading-none text-black/45 transition hover:bg-black/5 hover:text-black dark:text-white/45 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <span aria-hidden>✕</span>
          </button>
        </header>

        {/* Calendar left, weekend panel right; stacked on a phone with the
            panel below, where the thumb is. Each side scrolls alone — picking
            a December weekend must not scroll the flight list away, and
            reading a long flight list must not lose your place in the year. */}
        <div className="flex min-h-0 flex-1 flex-col sm:flex-row">
          {/* overscroll-contain on both scrollers: even with the page locked,
              a trackpad fling that runs out of calendar should die here, not
              rubber-band the dialog. */}
          <div className="flex min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {/* m-auto on a flex child centres the calendar BLOCK in the pane —
                both axes — instead of pinning it to the top-left corner of a
                mostly empty fullscreen sheet. On a screen where the calendar
                overflows, auto margins collapse to zero and it degrades to a
                normally scrolling top-aligned block; max-w keeps the month
                columns from gliding apart on very wide monitors. */}
            <div className="m-auto w-full max-w-5xl">
              <CalendarView
                deals={deals}
                currency={currency}
                selected={shownKey}
                onSelect={setSelected}
              />
            </div>
          </div>

          <aside
            aria-label="Flights for the selected weekend"
            className="flex min-h-0 shrink-0 basis-[45%] flex-col border-t border-black/[0.07] sm:h-auto sm:w-[420px] sm:basis-auto sm:border-t-0 sm:border-l dark:border-white/10"
          >
            {first ? (
              <>
                <div className="shrink-0 border-b border-black/[0.07] px-4 py-3 dark:border-white/10">
                  <h3 className="text-sm font-semibold tracking-tight">
                    {weekendRange(first.outDepart, first.backDepart)}
                  </h3>
                  <p className="text-[12.5px] text-black/55 dark:text-white/55">
                    {trips.length} flight{trips.length === 1 ? "" : "s"} this
                    weekend, cheapest first
                  </p>
                </div>
                {/* [&>*]:shrink-0 is what makes this column SCROLL rather
                    than crush. The cards are flex children, the card root is
                    overflow-hidden, and overflow-hidden gives a flex item a
                    min-content height of ~zero — so expanding a card made the
                    others (and itself) compress to keep fitting, measured as
                    scrollHeight == clientHeight with a card open. Reported as
                    "the expanded card cannot be scrolled": there was nothing
                    to scroll, because nothing was allowed to overflow. */}
                <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3 [&>*]:shrink-0">
                  {trips.map((d) => (
                    <DealCard
                      key={d.deepLink}
                      deal={d}
                      idPrefix="dates-"
                      hideStops={hideStops}
                    />
                  ))}
                </div>
              </>
            ) : (
              <p className="p-4 text-sm text-black/55 dark:text-white/55">
                Tap a weekend on the calendar to see every flight on it.
              </p>
            )}
          </aside>
        </div>
      </div>
    </dialog>
  );
}
