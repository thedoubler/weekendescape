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
    // Scrolls rather than wraps. A filter row that grows a second line pushes
    // the board down every time it does — and merging all the rows into ONE
    // scroller was measured at 1007px of chips in a 358px box, which would hide
    // two thirds of the controls. Per-row, at 390px, this fits, so the scroller
    // is insurance rather than the normal case.
    <div
      role="group"
      aria-label="Month filter"
      className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
