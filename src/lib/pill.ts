// Shared pill styling for the filter controls (Month, Region, Max price).
// Active = solid black/white fill flip; inactive = hairline outline.
//
// `disabled` is the third state, and it exists because a facet option that
// would return nothing is a dead end the UI walked you into. It reads as
// clearly unavailable — dimmed, no hover, no pointer — rather than merely
// quiet, so the difference between "few results" and "no results" is visible
// before the click rather than after it.
export function pillClass(active: boolean, disabled = false): string {
  if (disabled) {
    return "rounded-full px-3 py-1 text-sm border border-black/[0.06] text-black/25 cursor-not-allowed dark:border-white/[0.08] dark:text-white/25";
  }
  return `rounded-full px-3 py-1 text-sm transition ${
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/15"
  }`;
}
