// One door per facet. The whole filter apparatus costs a single row, and that
// cost is independent of how many months, regions or price bands the board
// happens to have — which is the property three rows of chips did not have.
//
// Each trigger says what the filter IS SET TO, never how many options sit
// behind it. Unset that means "Any month"; set, it becomes "✓ Aug". Same
// grammar as the receipt line above, which also prints values ("direct",
// "1 adult") rather than fields.
//
// The option count that used to sit here ("Month 6") is gone for three
// reasons. It was ambiguous — "Month 6" reads as June on a board where every
// other number is a date or a price, and "Price 4" named a quantity of
// buckets, which is an implementation detail nobody asked about. It collided —
// the dim number in "Region 3" meant options while the dim number in
// "Europe 12" forty pixels below meant deals. And it was answering a question
// the chevron already answers: that there is something to open.
export function FacetTrigger({
  label,
  placeholder,
  value,
  open,
  onClick,
  controls,
}: {
  /** The field name. Spoken, never shown — the visible text is the value. */
  label: string;
  /** What the trigger reads when nothing is chosen, e.g. "Any month". */
  placeholder: string;
  value?: string | null;
  open: boolean;
  onClick: () => void;
  controls: string;
}) {
  const set = !!value;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls={controls}
      // The visible text is a value; read aloud it does not identify which
      // field it belongs to, so the accessible name puts the field back. It
      // still CONTAINS the visible text, which is what WCAG 2.5.3 requires.
      aria-label={`${label}: ${value ?? placeholder}. Change`}
      // `border` on BOTH branches, colour-only flip. pillClass drops the border
      // when active, which is invisible on a lone chip but a 2px jump in a row
      // of three triggers.
      // h-9, not py-1.5: at 34px these sat 2px shy of the Sort control and
      // the Map button they share a row with, which reads as a wobble rather
      // than as a size difference.
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm transition ${
        set
          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
          : open
            ? "border-black/45 bg-black/[0.04] text-black/75 dark:border-white/50 dark:bg-white/10 dark:text-white/75"
            : "border-black/15 text-black/75 hover:bg-black/5 dark:border-white/20 dark:text-white/75 dark:hover:bg-white/10"
      }`}
    >
      {set && <span aria-hidden>✓</span>}
      {value ?? placeholder}
      <span aria-hidden className="-ml-px text-[10px] opacity-55">
        {open ? "▲" : "▼"}
      </span>
    </button>
  );
}
