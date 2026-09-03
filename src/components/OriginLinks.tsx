import { ORIGIN_PAGES } from "@/lib/origin-pages";

const BY_CODE = new Map(ORIGIN_PAGES.map((o) => [o.code, o]));

// The crawl graph, made visible. The origin boards are the site's indexable
// surface, and until this existed they were islands: nothing linked between
// them and the homepage linked to none of them. A crawler (or an LLM
// reading without JS) can now walk from any page to every board.
//
// No "use client": plain markup, so it lands in the PRERENDERED HTML of the
// board page too — which is the whole point.
export function OriginLinks({
  codes,
  exclude,
}: {
  /** A curated subset in display order (the homepage's mix); omit for all. */
  codes?: string[];
  /** The current page's own code — a page linking to itself is noise. */
  exclude?: string;
}) {
  const base = codes
    ? codes.map((c) => BY_CODE.get(c)).filter((o): o is NonNullable<typeof o> => !!o)
    : ORIGIN_PAGES;
  const shown = base.filter((o) => o.code !== exclude?.toUpperCase());
  return (
    <nav
      aria-label="Weekend boards for other airports"
      className="flex flex-col gap-2"
    >
      <h2 className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        Cheap weekends from
      </h2>
      <p className="text-[13px] leading-relaxed">
        {shown.map((o, i) => (
          <span key={o.code}>
            {i > 0 && (
              <span aria-hidden className="text-black/25 dark:text-white/25">
                {" · "}
              </span>
            )}
            <a
              href={`/from/${o.code.toLowerCase()}`}
              className="whitespace-nowrap text-muted-foreground underline decoration-black/15 underline-offset-4 transition-colors hover:text-black dark:decoration-white/20 dark:hover:text-white"
            >
              {o.city}
            </a>
          </span>
        ))}
      </p>
    </nav>
  );
}
