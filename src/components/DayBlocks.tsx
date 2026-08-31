import type { DayCell } from "@/lib/format";

// Inline Lucide icons (currentColor) for arrival/departure, so they render
// consistently across platforms and adapt to light/dark — unlike the ✈ emoji.
function PlaneLandingIcon({ className }: { className?: string }) {
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
      <path d="M2 22h20" />
      <path d="M3.77 10.77 2 9l2-4.5 1.1.55c.55.28.9.84.9 1.45s.35 1.17.9 1.45L8 8.5l3-6 1.05.53a2 2 0 0 1 1.09 1.52l.72 5.4a2 2 0 0 0 1.09 1.52l4.4 2.2c.42.22.78.55 1.01.96l.6 1.03c.49.88-.06 1.98-1.06 2.1l-1.18.15c-.47.06-.95-.02-1.37-.24L4.29 11.15a2 2 0 0 1-.52-.38Z" />
    </svg>
  );
}

function PlaneTakeoffIcon({ className }: { className?: string }) {
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
      <path d="M2 22h20" />
      <path d="M6.36 17.4 4 17l-2-4 1.1-.55a2 2 0 0 1 1.8 0l.17.1a2 2 0 0 0 1.8 0L8 12 5 6l.9-.45a2 2 0 0 1 2.09.2l4.02 3a2 2 0 0 0 2.1.2l4.19-2.06a2.41 2.41 0 0 1 1.73-.17L21 7a1.4 1.4 0 0 1 .87 1.99l-.38.76c-.23.46-.6.84-1.07 1.08L7.58 17.2a2 2 0 0 1-1.22.18Z" />
    </svg>
  );
}

// Destination (local) holiday marker — a teal map-pin, deliberately a different
// colour + shape from the amber "your day off" language so the two never blur.
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

export function DayBlocks({
  cells,
  arrival,
  departure,
  holiday,
  cityTo,
  homeHolidays,
  daysOff,
  legs,
}: {
  cells: DayCell[];
  arrival: { time: string; night: boolean; plusOne: boolean };
  departure: { time: string; night: boolean };
  // A destination (local) public holiday within the trip — marked with a teal
  // map-pin on its day. Name announced via aria-label + shown in the expanded panel.
  holiday?: { date: string; name: string } | null;
  cityTo?: string;
  // Bridge mode: the home public holidays that make this a long weekend (a trip
  // can span more than one), and the workdays you'd book off — tagged on their
  // days so the puente reads at a glance.
  homeHolidays?: { date: string; name: string }[] | null;
  daysOff?: string[] | null;
  // Hover text for the first and last cells. The strip shows the days you get
  // AT the destination, so on an itinerary that crosses midnight the day you
  // actually leave home appears nowhere on the collapsed card — 20% of results
  // once stops are allowed. Rather than restate it and make every card longer,
  // it hangs off the two cells it belongs to.
  legs?: { arrive?: string; leave?: string } | null;
}) {
  const months: string[] = [];
  for (const c of cells) if (!months.includes(c.month)) months.push(c.month);

  // When any day carries a "you're off" / "book off" tag, reserve that row on
  // every cell (invisible on the untagged ones) so the hours-bar stays on
  // one straight line across the strip instead of dropping under the tagged days.
  const hasTags =
    (homeHolidays?.length ?? 0) > 0 || (daysOff?.length ?? 0) > 0;

  return (
    <div>
      <div className="mb-1 text-[11px] text-muted">
        {months.join(" – ")}
      </div>
      <div className="flex gap-1.5" role="list" aria-label="Trip days">
        {cells.map((c, i) => {
          const usable = Math.round((c.fillEnd - c.fillStart) * 100);
          const showArrive = c.role === "arrive" || c.role === "solo";
          const showLeave = c.role === "leave" || c.role === "solo";
          const isHoliday = !!holiday && holiday.date === c.date;
          const isHomeHoliday = !!homeHolidays?.some((h) => h.date === c.date);
          const isDayOff = !!daysOff && daysOff.includes(c.date);
          return (
            <div
              key={i}
              role="listitem"
              // `title` is the hover affordance; the same fact goes into the
              // accessible name below, because title alone is not reliably
              // announced and is invisible on touch.
              title={
                (showArrive ? legs?.arrive : undefined) ??
                (showLeave ? legs?.leave : undefined)
              }
              aria-label={`${c.weekday} ${c.day}, ${usable}% of the day usable${
                showArrive && legs?.arrive ? `. ${legs.arrive}` : ""
              }${showLeave && legs?.leave ? `. ${legs.leave}` : ""}${
                isHomeHoliday ? ", your public holiday — off work" : ""
              }${isDayOff ? ", day off to book" : ""}${
                isHoliday
                  ? `, local holiday in ${cityTo ?? "the destination"}: ${holiday!.name}`
                  : ""
              }`}
              // Neutral cell, always. It used to fill amber for every day you
              // are off work — which on a bridge-days board is 54% of the
              // cells, so the tint marked nothing and simply became the
              // background. Those cells already carry a "you're off" chip; the
              // fill was a second device for the same fact.
              className="min-w-0 flex-1 rounded-lg bg-black/[0.04] px-1.5 py-2.5 text-center dark:bg-white/[0.06]"
            >
              <div className="text-[11px] font-medium uppercase tracking-wider text-muted">
                {c.weekday}
              </div>
              <div className="mt-0.5 flex items-center justify-center gap-0.5 text-sm font-semibold leading-none">
                {c.day}
                {isHoliday && (
                  <MapPinIcon className="h-3 w-3 shrink-0 text-teal-600 dark:text-teal-400" />
                )}
              </div>
              {hasTags && (
                <div
                  className={`mt-1 rounded-full border px-1 py-0.5 text-[8px] font-semibold uppercase leading-none tracking-wide ${
                    isHomeHoliday
                      ? "border-transparent bg-amber-200/80 text-amber-900 dark:bg-amber-300/25 dark:text-amber-100"
                      : isDayOff
                        ? "border-dashed border-black/25 text-muted dark:border-white/30"
                        : "invisible border-transparent"
                  }`}
                >
                  {isHomeHoliday ? "you’re off" : isDayOff ? "book off" : " "}
                </div>
              )}
              {/* Hours at the destination as a slice of the day (arrival→departure). */}
              {/* 4px. Sized when it was a pale orange gradient; as a solid
                  neutral the same height read far heavier than the proportion
                  it encodes. Margins absorb the difference so the card height —
                  and the skeleton calibrated to it — is unchanged at 238px. */}
              <div className="relative my-3 h-1 overflow-hidden rounded-full bg-black/[0.07] dark:bg-white/[0.12]">
                <div
                  // Neutral, not accent. Three of these per card x ~13 cards
                  // put ~40 high-chroma marks on a screen whose whole premise
                  // is PRICE — the eye landed on hours-at-destination first.
                  // A bar reads as a proportion from its LENGTH; neither colour
                  // nor weight adds anything, and at 8px a full-day bar read as
                  // a horizontal rule cutting the cell in half. 4px.
                  className="absolute inset-y-0 rounded-full bg-black/35 dark:bg-white/45"
                  style={{
                    left: `${c.fillStart * 100}%`,
                    width: `${(c.fillEnd - c.fillStart) * 100}%`,
                  }}
                />
              </div>
              {showArrive && (
                <div className="flex items-center justify-center gap-0.5 text-[11px] text-black/70 dark:text-white/70">
                  <PlaneLandingIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="sr-only">Arrives </span>
                  <span className="tabular-nums">{arrival.time}</span>
                  {arrival.plusOne && <span>+1</span>}
                  {arrival.night && (
                    <span aria-label="Night flight" className="ml-0.5">
                      🌙
                    </span>
                  )}
                </div>
              )}
              {showLeave && (
                <div className="flex items-center justify-center gap-0.5 text-[11px] text-black/70 dark:text-white/70">
                  <PlaneTakeoffIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="sr-only">Departs </span>
                  <span className="tabular-nums">{departure.time}</span>
                  {departure.night && (
                    <span aria-label="Night flight" className="ml-0.5">
                      🌙
                    </span>
                  )}
                </div>
              )}
              {c.role === "middle" && (
                <div className="text-[11px] text-muted">
                  full day
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
