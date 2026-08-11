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
      className="-mx-1 flex snap-x gap-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
      <button
        type="button"
        aria-pressed={!capped}
        onClick={() => onChange(max)}
        className={pillClass(!capped)}
      >
        Any
      </button>
    </div>
  );
}
