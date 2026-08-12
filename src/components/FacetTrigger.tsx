// One door per facet. The whole filter apparatus costs a single row, and that
// cost is independent of how many months, regions or price bands the board
// happens to have — which is the property three rows of chips did not have.
//
// The rule that makes hiding survivable, borrowed from Kayak Explore: once a
// facet is SET, the trigger stops naming the field and shows the chosen value.
// "Region" becomes "✓ Europe". So a filtered board still says what it is
// filtered to without opening anything.
//
// The count ("Month 4") is deliberately suppressed once the facet is open. Its
// job is to answer "what is behind this door" for a door you have not opened;
// the moment the chips are on screen it is redundant, AND it collides — the
// dim number in "Region 3" means options while the dim number in "Europe 12"
// forty pixels below means deals. Same treatment, two meanings. Showing it only
// while closed means the two are never on screen together.
export function FacetTrigger({
  label,
  count,
  value,
  open,
  onClick,
  controls,
}: {
  label: string;
  count: number;
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
      // The visible label drops the field name once a value is set — "Europe"
      // identifies itself. Read aloud it does not, so the accessible name keeps
      // the field, and keeps the option count the sighted user loses on open.
      aria-label={
        set ? `${label}: ${value}. Change` : `${label}, ${count} options`
      }
      // `border` on BOTH branches, colour-only flip. pillClass drops the border
      // when active, which is invisible on a lone chip but a 2px jump in a row
      // of three triggers.
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
        set
          ? "border-black bg-black text-white dark:border-white dark:bg-white dark:text-black"
          : open
            ? "border-black/45 bg-black/[0.04] text-black/75 dark:border-white/50 dark:bg-white/10 dark:text-white/75"
            : "border-black/15 text-black/75 hover:bg-black/5 dark:border-white/20 dark:text-white/75 dark:hover:bg-white/10"
      }`}
    >
      {set ? (
        <>
          <span aria-hidden>✓</span>
          {value}
        </>
      ) : (
        <>
          {label}
          {!open && (
            <span aria-hidden className="tabular-nums opacity-50">
              {count}
            </span>
          )}
        </>
      )}
      <span aria-hidden className="-ml-px text-[10px] opacity-55">
        {open ? "▲" : "▼"}
      </span>
    </button>
  );
}
