import type { DayCell } from "@/lib/format";

export function DayBlocks({ cells }: { cells: DayCell[] }) {
  return (
    <div className="flex gap-1" role="list" aria-label="Trip days">
      {cells.map((c, i) => (
        <div
          key={i}
          role="listitem"
          className={`flex-1 rounded-md px-1 py-1 text-center text-xs ${
            c.isWeekend
              ? "bg-orange-200 text-orange-900 dark:bg-orange-300/30 dark:text-orange-100"
              : "bg-black/5 text-black/60 dark:bg-white/10 dark:text-white/60"
          }`}
        >
          <div>{c.weekday}</div>
          <div className="font-medium">{c.day}</div>
          {c.role === "depart" && <div aria-label="Departure">🛫</div>}
          {c.role === "return" && <div aria-label="Return">🛬</div>}
        </div>
      ))}
    </div>
  );
}
