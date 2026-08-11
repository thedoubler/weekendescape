import { monthShort } from "@/lib/format";
import { pillClass } from "@/lib/pill";

export function MonthFilter({
  months,
  selected,
  onToggle,
  onClear,
}: {
  months: string[];
  selected: string[];
  onToggle: (m: string) => void;
  onClear: () => void;
}) {
  if (months.length === 0) return null;
  const sel = new Set(selected);
  return (
    // Scrolls rather than wraps. A filter row that grows a second line pushes
    // the board down every time it does — and merging all the rows into ONE
    // scroller was measured at 1007px of chips in a 358px box, which would hide
    // two thirds of the controls. Per-row, at 390px, this fits (275px), so the
    // scroller is insurance rather than the normal case.
    <div
      role="group"
      aria-label="Month filter"
      className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={selected.length === 0}
        onClick={onClear}
        className={pillClass(selected.length === 0)}
      >
        All
      </button>
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
