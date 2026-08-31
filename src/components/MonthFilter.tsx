import { monthShort } from "@/lib/format";
import { pillClass } from "@/lib/pill";

export function MonthFilter({
  months,
  selected,
  counts,
  onToggle,
}: {
  months: string[];
  selected: string[];
  /** Deals this month would surface GIVEN the region/price already chosen.
   *  NOT rendered — see the house rule in docs/ideas-and-research.md. It is
   *  read only to decide which options are dead, so the pill can grey out
   *  instead of promising a result it cannot deliver. */
  counts?: Record<string, number>;
  onToggle: (m: string) => void;
}) {
  if (months.length === 0) return null;
  const sel = new Set(selected);
  return (
    // No "All" chip. A row with nothing selected already means all, and the
    // chip spent the heaviest ink on the page — a solid black fill — on the
    // ABSENCE of a choice, three times over, on a board with no filters on.
    // Fill now only ever marks a real selection. Clearing is tapping the lit
    // chip again, or Clear all in the header beside the removable chips.
    //
    // WRAPS. It used to scroll horizontally, on the argument that a second line
    // pushes the board down. Measured on the live app at 390px: a seven-month
    // row is 390px of chips in a 282px box, so 108px of months sat off-screen
    // behind an invisible swipe with no affordance pointing at them. That is
    // the "options are disappearing" complaint, shipped. A row that grows is
    // honest; a row that silently truncates is not — and now that these only
    // render when their facet is open, the extra line is opted into.
    <div
      role="group"
      aria-label="Month filter"
      className="flex flex-wrap gap-1"
    >
      {months.map((m) => {
        const on = sel.has(m);
        const n = counts?.[m];
        // A SELECTED pill is never disabled even at zero, or a filter that
        // narrows to nothing could not be undone.
        const dead = !on && n === 0;
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            disabled={dead}
            onClick={() => onToggle(m)}
            className={pillClass(on, dead)}
          >
            {on && <span aria-hidden>✓ </span>}
            {monthShort(m)}
          </button>
        );
      })}
    </div>
  );
}
