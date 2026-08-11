import { type Deal, dealDomId } from "@/lib/deals";
import {
  type WeekendStyle,
  WEEKEND_SHAPE,
  matchesWeekendShape,
} from "@/lib/weekend";
import { monthKey, monthTitle } from "@/lib/format";
import { DealCard } from "@/components/DealCard";

interface MonthSection {
  key: string;
  title: string;
  deals: Deal[];
}

// Placeholder that mirrors a collapsed DealCard's shape, so results swap in
// without the layout jumping. Pulses (unless the user prefers reduced motion).
//
// The comment above used to be aspirational: the skeleton was 190px against a
// real card's 238, so five of them shifted the page ~240px the moment results
// landed. Heights below are derived from a measured card, not chosen to look
// right: 2 border + 32 padding + 44 header + (12 + 116) day block +
// (12 + 20) footer = 238. Re-measure if the card's structure changes.
export function SkeletonCard() {
  const bar = "rounded bg-black/[0.06] dark:bg-white/[0.08]";
  return (
    <div className="rounded-xl border border-black/10 p-4 motion-safe:animate-pulse dark:border-white/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className={`h-5 w-6 ${bar}`} />
            <div className={`h-5 w-32 ${bar}`} />
          </div>
          <div className={`mt-2 h-4 w-44 ${bar}`} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={`h-5 w-16 ${bar}`} />
          <div className={`h-3 w-12 ${bar}`} />
        </div>
      </div>
      <div className={`mt-3 mb-1 h-3 w-8 ${bar}`} />
      <div className="flex gap-1">
        <div className={`h-[100px] flex-1 ${bar}`} />
        <div className={`h-[100px] flex-1 ${bar}`} />
        <div className={`h-[100px] flex-1 ${bar}`} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className={`h-5 w-24 ${bar}`} />
        <div className="flex gap-3">
          <div className={`h-5 w-10 ${bar}`} />
          <div className={`h-5 w-12 ${bar}`} />
        </div>
      </div>
    </div>
  );
}

// Consecutive deals (soonest sort is date-ascending) collapse into month runs.
function toSections(deals: Deal[]): MonthSection[] {
  const sections: MonthSection[] = [];
  for (const deal of deals) {
    const key = monthKey(deal.outDepart);
    const last = sections[sections.length - 1];
    if (last && last.key === key) last.deals.push(deal);
    else sections.push({ key, title: monthTitle(deal.outDepart), deals: [deal] });
  }
  return sections;
}

export function DealList({
  deals,
  focusId,
  focusSeq,
  showOrigin,
  loading,
  error,
  emptyMessage,
  cheapest,
  groupByMonth = false,
  splitShape,
  onClearFilters,
  onHover,
}: {
  deals: Deal[];
  // When the map asks for a specific card, that card opens.
  focusId?: string;
  focusSeq?: number;
  // Multiple home airports in play — cards must name their departure airport.
  showOrigin?: boolean;
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
  cheapest?: { style: WeekendStyle; months: number; direct: boolean; adults: number };
  groupByMonth?: boolean;
  // When set, split results into "exactly this shape" first, then a labelled
  // "close matches" section for the rest — so the list is honest about the
  // preset without throwing away the cheaper near-miss inventory. Omitted in
  // bridge-days mode, where off-shape puentes are the whole point.
  splitShape?: WeekendStyle;
  onClearFilters?: () => void;
  onHover?: (flyTo: string | null) => void;
}) {
  if (loading)
    return (
      <div
        className="flex flex-col gap-3"
        aria-busy="true"
        aria-label="Searching for escapes"
      >
        {Array.from({ length: 5 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  if (error) return <p className="text-red-500">{error}</p>;
  if (deals.length === 0)
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="opacity-70">
          {emptyMessage ??
            "No weekend escapes found — try the Loose style or a longer timeline."}
        </p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="rounded-full border border-black/15 px-3.5 py-1.5 text-sm text-black/70 transition hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
          >
            Clear filters
          </button>
        )}
      </div>
    );

  const card = (deal: Deal, i: number) => (
    <DealCard
      key={`${deal.cityTo}-${deal.outDepart}-${i}`}
      deal={deal}
      cheapest={cheapest}
      showOrigin={showOrigin}
      // Only the targeted card gets a seq, so only it reacts.
      focusSeq={dealDomId(deal) === focusId ? focusSeq : undefined}
      onHover={onHover}
    />
  );

  // Render a list either flat or grouped into sticky-header month runs.
  const renderDeals = (list: Deal[]) =>
    groupByMonth
      ? toSections(list).map((section) => (
          <section key={section.key} className="flex flex-col gap-3">
            {/* Pins below the active-filter bar when there is one, and at the
                viewport top when there isn't. The page owns the variable, since
                only it knows whether that bar exists. */}
            <div className="sticky top-[var(--list-sticky-top,0px)] z-10 flex items-baseline gap-2 bg-background/85 pb-1 pt-1 backdrop-blur-sm">
              <span className="text-sm font-semibold tracking-tight">
                {section.title}
              </span>
              {/* "August" beside a bare "6" reads as August 6th — a date, in a
                  product whose every other number IS a date or a price. The
                  noun is what disambiguates it. */}
              <span className="text-xs tabular-nums text-black/45 dark:text-white/45">
                {section.deals.length} flight
                {section.deals.length === 1 ? "" : "s"}
              </span>
            </div>
            {section.deals.map(card)}
          </section>
        ))
      : list.map(card);

  // No shape split (or bridge mode): render the list as-is.
  if (!splitShape) {
    return <div className="flex flex-col gap-3">{renderDeals(deals)}</div>;
  }

  // Exactly the shape the preset names, then everything else as "close matches".
  const exact = deals.filter((d) =>
    matchesWeekendShape(d.outArrive, d.backDepart, splitShape)
  );
  const close = deals.filter(
    (d) => !matchesWeekendShape(d.outArrive, d.backDepart, splitShape)
  );
  const label = WEEKEND_SHAPE[splitShape].label;

  return (
    <div className="flex flex-col gap-3">
      {exact.length > 0 && renderDeals(exact)}
      {close.length > 0 && (
        <>
          {/* A section break, not a caption. At 12px/50% between two hairlines
              it read as a divider that happened to have words on it, and it is
              actually the most important label on the board — everything below
              it is NOT the weekend shape you asked for. */}
          <div className="flex items-center gap-3 pt-6 pb-2">
            <div className="h-px flex-1 bg-black/15 dark:bg-white/15" />
            <span className="rounded-full bg-black/[0.05] px-3.5 py-1.5 text-base font-semibold text-black/70 dark:bg-white/[0.08] dark:text-white/70">
              {exact.length === 0
                ? `No exact ${label} — closest matches`
                : `Not exactly ${label} · ${close.length} close ${
                    close.length === 1 ? "match" : "matches"
                  }`}
            </span>
            <div className="h-px flex-1 bg-black/15 dark:bg-white/15" />
          </div>
          {renderDeals(close)}
        </>
      )}
    </div>
  );
}
