// Shared pill styling for the filter controls (Month, Region, Max price).
// Active = solid black/white fill flip; inactive = hairline outline.
export function pillClass(active: boolean): string {
  return `rounded-full px-3 py-1 text-sm transition ${
    active
      ? "bg-black text-white dark:bg-white dark:text-black"
      : "text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/10 border border-black/10 dark:border-white/15"
  }`;
}
