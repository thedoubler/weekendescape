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
    <div role="group" aria-label="Month filter" className="flex flex-wrap gap-1">
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
