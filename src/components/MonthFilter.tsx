import { monthShort } from "@/lib/format";
import { pillClass } from "@/lib/pill";

export function MonthFilter({
  months,
  selected,
  onToggle,
}: {
  months: string[];
  selected: string[];
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
      {months.map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={sel.has(m)}
          onClick={() => onToggle(m)}
          className={pillClass(sel.has(m))}
        >
          {sel.has(m) && <span aria-hidden>✓ </span>}
          {monthShort(m)}
        </button>
      ))}
    </div>
  );
}
