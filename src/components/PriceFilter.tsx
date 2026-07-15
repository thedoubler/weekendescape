export function PriceFilter({
  min,
  max,
  value,
  currency,
  onChange,
}: {
  min: number;
  max: number;
  value: number;
  currency: string;
  onChange: (v: number) => void;
}) {
  if (max <= min) return null;
  return (
    <div
      role="group"
      aria-label="Max price"
      className="flex items-center gap-3"
    >
      <span className="whitespace-nowrap text-sm opacity-70">
        Under {value} {currency}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Maximum price"
        className="w-40 accent-black dark:accent-white"
      />
    </div>
  );
}
