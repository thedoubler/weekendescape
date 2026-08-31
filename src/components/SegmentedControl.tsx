export interface SegOption<T extends string | number> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: SegOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      // grow + full-width segments below `sm`: on a phone this control shares
      // its row with nothing it can defer to, and self-sized it left dead
      // space beside it. Each segment takes half the pill, so the two tap
      // targets are as large as the row allows. From `sm` up it self-sizes
      // again and sits in the bar's right-hand cluster.
      className="inline-flex grow items-center gap-0.5 rounded-full bg-black/[0.055] p-0.5 sm:grow-0 dark:bg-white/[0.07]"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            // py-3 below `sm` takes the button to 44px, the iOS tap floor; the
            // 0.5 wrapper padding makes the control 48px. px-2.5 there keeps the
            // pair inside a 328px row on a 360px phone.
            className={`flex-1 rounded-full px-2.5 py-3 text-sm transition-colors sm:flex-none sm:px-3.5 sm:py-1.5 ${
              active
                ? "bg-white text-black shadow-sm dark:bg-neutral-700 dark:text-white"
                : "text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
