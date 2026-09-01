import { pillClass } from "@/lib/pill";

export function PriceFilter({
  buckets,
  max,
  value,
  currency,
  onChange,
}: {
  buckets: number[];
  max: number;
  value: number;
  currency: string;
  onChange: (v: number) => void;
}) {
  if (buckets.length === 0) return null;
  const capped = value < max;
  return (
    // The currency lives in the field label, not on every chip. "≤ 175 EUR" ×5
    // measured 431px against a 358px phone box; the number alone is ~45px, so
    // the row fits with room to spare. Every price on the board below already
    // carries its currency — repeating it five times here bought nothing.
    <div
      role="group"
      aria-label={`Max price in ${currency}`}
      className="flex flex-wrap gap-1"
    >
      {buckets.map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={value === b}
          onClick={() => onChange(b)}
          className={`${pillClass(value === b)} whitespace-nowrap tabular-nums`}
          // The bare number is ambiguous read aloud, so the accessible name
          // keeps the words the visible label drops.
          aria-label={`Up to ${b} ${currency}`}
        >
          ≤ {b}
        </button>
      ))}
      {/* Price is single-select, so unlike Month and Region a lit chip cannot
          be tapped off — this row genuinely needs a reset. It just doesn't need
          one while there is nothing to reset: shown always, "Any" sat filled
          and black on an unfiltered board, which put the page's heaviest ink on
          the absence of a choice. */}
      {capped && (
        <button
          type="button"
          onClick={() => onChange(max)}
          className="shrink-0 rounded-full px-3 py-1 text-sm whitespace-nowrap text-muted-foreground underline underline-offset-4 transition hover:text-black dark:hover:text-white"
        >
          Any
        </button>
      )}
    </div>
  );
}
