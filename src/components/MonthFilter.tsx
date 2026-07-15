const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function monthName(ym: string): string {
  const m = Number(ym.slice(5, 7));
  return MONTH_NAMES[m - 1] ?? ym;
}

function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm transition ${
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/15"
  }`;
}

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
          {monthName(m)}
        </button>
      ))}
    </div>
  );
}
