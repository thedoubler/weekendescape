import { pillClass } from "@/lib/pill";

export function ContinentFilter({
  continents,
  selected,
  counts,
  onToggle,
  onClear,
}: {
  continents: string[];
  selected: string[];
  counts?: Record<string, number>;
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
          {sel.has(c) && <span aria-hidden>✓ </span>}
          {c}
          {counts?.[c] != null && (
            <span aria-hidden className="ml-1.5 opacity-55">
              {counts[c]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
