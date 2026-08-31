import { pillClass } from "@/lib/pill";

export function ContinentFilter({
  continents,
  selected,
  counts,
  onToggle,
}: {
  continents: string[];
  selected: string[];
  /** Read to decide which options are dead, never rendered — see the house
   *  rule in docs/ideas-and-research.md. This row DID print "Europe 13" until
   *  the rule landed. */
  counts?: Record<string, number>;
  onToggle: (c: string) => void;
}) {
  if (continents.length < 2) return null;
  const sel = new Set(selected);
  return (
    // No "All" chip — see MonthFilter.
    <div
      role="group"
      aria-label="Continent filter"
      className="flex flex-wrap gap-1"
    >
      {continents.map((c) => {
        const on = sel.has(c);
        const n = counts?.[c];
        // See MonthFilter: a selected pill stays live so it can be turned off.
        const dead = !on && n === 0;
        return (
          <button
            key={c}
            type="button"
            aria-pressed={on}
            disabled={dead}
            onClick={() => onToggle(c)}
            className={pillClass(on, dead)}
          >
            {on && <span aria-hidden>✓ </span>}
            {c}
          </button>
        );
      })}
    </div>
  );
}
