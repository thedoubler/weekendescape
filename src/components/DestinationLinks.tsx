import { DESTINATION_PAGES } from "@/lib/destination-pages";

// The destination half of the crawl graph — OriginLinks' twin. Server
// component on purpose: the links must exist in prerendered HTML.
export function DestinationLinks({
  codes,
  exclude,
}: {
  /** A curated subset of slugs in display order; omit for all. */
  codes?: string[];
  /** The current page's own slug. */
  exclude?: string;
}) {
  const base = codes
    ? codes
        .map((s) => DESTINATION_PAGES.find((d) => d.slug === s))
        .filter((d): d is NonNullable<typeof d> => !!d)
    : DESTINATION_PAGES;
  const shown = base.filter((d) => d.slug !== exclude?.toLowerCase());
  return (
    <nav aria-label="Weekend guides for other cities" className="flex flex-col gap-2">
      <h2 className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        A weekend in
      </h2>
      <p className="text-[13px] leading-relaxed">
        {shown.map((d, i) => (
          <span key={d.slug}>
            {i > 0 && (
              <span aria-hidden className="text-black/25 dark:text-white/25">
                {" · "}
              </span>
            )}
            <a
              href={`/weekends-in/${d.slug}`}
              className="whitespace-nowrap text-muted-foreground underline decoration-black/15 underline-offset-4 transition-colors hover:text-black dark:decoration-white/20 dark:hover:text-white"
            >
              {d.city}
            </a>
          </span>
        ))}
      </p>
    </nav>
  );
}
