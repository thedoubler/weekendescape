import type { DayCell } from "@/lib/format";

export function DayBlocks({
  cells,
  arrival,
  departure,
}: {
  cells: DayCell[];
  arrival: { time: string; night: boolean; plusOne: boolean };
  departure: { time: string; night: boolean };
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
          return (
            <div
              key={i}
              role="listitem"
              aria-label={`${c.weekday} ${c.day}, ${usable}% of the day usable`}
              className="flex-1 rounded-md bg-black/5 px-1 py-1 text-center text-xs dark:bg-white/10"
            >
              <div className="text-black/60 dark:text-white/60">{c.weekday}</div>
              <div
                className={`font-medium ${
                  c.isWeekend ? "text-orange-700 dark:text-orange-300" : ""
                }`}
              >
                {c.day}
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
                <div className="text-black/70 dark:text-white/70">
                  🛬 <span>{arrival.time}</span>
                  {arrival.plusOne && <span> +1</span>}
                  {arrival.night && <span aria-label="Night flight"> 🌙</span>}
                </div>
              )}
              {showLeave && (
                <div className="text-black/70 dark:text-white/70">
                  🛫 <span>{departure.time}</span>
                  {departure.night && <span aria-label="Night flight"> 🌙</span>}
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
