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

export function DayBlocks({
  cells,
  arrival,
  departure,
  holiday,
}: {
  cells: DayCell[];
  arrival: { time: string; night: boolean; plusOne: boolean };
  departure: { time: string; night: boolean };
  // A destination public holiday falling within the trip, marked with a dot on
  // its day. The name is announced via aria-label and shown in the card's
  // expanded panel (the strip can't own a tooltip — it's inside the expand
  // button), so the dot stays a quiet visual cue here.
  holiday?: { date: string; name: string } | null;
}) {
  const months: string[] = [];
  for (const c of cells) if (!months.includes(c.month)) months.push(c.month);

  return (
    <div>
      <div className="mb-1 text-[11px] text-black/40 dark:text-white/40">
        {months.join(" – ")}
      </div>
      <div className="flex gap-1" role="list" aria-label="Trip days">
        {cells.map((c, i) => {
          const usable = Math.round((c.fillEnd - c.fillStart) * 100);
          const showArrive = c.role === "arrive" || c.role === "solo";
          const showLeave = c.role === "leave" || c.role === "solo";
          const isHoliday = !!holiday && holiday.date === c.date;
          return (
            <div
              key={i}
              role="listitem"
              aria-label={`${c.weekday} ${c.day}, ${usable}% of the day usable${
                isHoliday ? `, public holiday: ${holiday!.name}` : ""
              }`}
              className="min-w-0 flex-1 rounded-md bg-black/5 px-1 py-1 text-center text-xs dark:bg-white/10"
            >
              <div className="text-black/60 dark:text-white/60">{c.weekday}</div>
              <div className="font-medium">
                {c.day}
                {isHoliday && (
                  <span
                    aria-hidden
                    title="Public holiday"
                    className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 align-middle dark:bg-amber-400"
                  />
                )}
              </div>
              <div className="relative my-1 h-1.5 rounded-full bg-black/10 dark:bg-white/15">
                <div
                  className="absolute inset-y-0 rounded-full bg-orange-300 dark:bg-orange-400/70"
                  style={{
                    left: `${c.fillStart * 100}%`,
                    width: `${(c.fillEnd - c.fillStart) * 100}%`,
                  }}
                />
              </div>
              {showArrive && (
                <div className="flex items-center justify-center gap-0.5 text-black/70 dark:text-white/70">
                  <PlaneLandingIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="sr-only">Arrives </span>
                  <span>{arrival.time}</span>
                  {arrival.plusOne && <span>+1</span>}
                  {arrival.night && (
                    <span aria-label="Night flight" className="ml-0.5">
                      🌙
                    </span>
                  )}
                </div>
              )}
              {showLeave && (
                <div className="flex items-center justify-center gap-0.5 text-black/70 dark:text-white/70">
                  <PlaneTakeoffIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="sr-only">Departs </span>
                  <span>{departure.time}</span>
                  {departure.night && (
                    <span aria-label="Night flight" className="ml-0.5">
                      🌙
                    </span>
                  )}
                </div>
              )}
              {c.role === "middle" && (
                <div className="text-black/40 dark:text-white/40">full day</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
