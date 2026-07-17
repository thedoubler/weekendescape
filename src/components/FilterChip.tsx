// A removable pill summarizing one active filter, shown above the results so
// filter state stays visible while the Refine panel is closed.
export function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-black/[0.06] py-1 pl-3 pr-1.5 text-sm dark:bg-white/[0.10]">
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="grid h-4 w-4 place-items-center rounded-full text-xs text-black/45 transition hover:bg-black/10 hover:text-black dark:text-white/45 dark:hover:bg-white/15 dark:hover:text-white"
      >
        ✕
      </button>
    </span>
  );
}
