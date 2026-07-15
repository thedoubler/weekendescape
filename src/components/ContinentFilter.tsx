function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm transition ${
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/15"
  }`;
}

export function ContinentFilter({
  continents,
  selected,
  onToggle,
  onClear,
}: {
  continents: string[];
  selected: string[];
  onToggle: (c: string) => void;
  onClear: () => void;
}) {
  if (continents.length < 2) return null;
  const sel = new Set(selected);
  return (
    <div
      role="group"
      aria-label="Continent filter"
      className="flex flex-wrap gap-1"
    >
      <button
        type="button"
        aria-pressed={selected.length === 0}
        onClick={onClear}
        className={pillClass(selected.length === 0)}
      >
        All
      </button>
      {continents.map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={sel.has(c)}
          onClick={() => onToggle(c)}
          className={pillClass(sel.has(c))}
        >
          {c}
        </button>
      ))}
    </div>
  );
}
