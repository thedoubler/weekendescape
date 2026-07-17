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
    <div role="group" aria-label="Max price" className="flex flex-wrap gap-1">
      {buckets.map((b) => (
        <button
          key={b}
          type="button"
          aria-pressed={value === b}
          onClick={() => onChange(b)}
          className={pillClass(value === b)}
        >
          ≤ {b} {currency}
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
