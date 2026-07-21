import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { monthKey, monthTitle } from "@/lib/format";
import { DealCard } from "@/components/DealCard";

interface MonthSection {
  key: string;
  title: string;
  deals: Deal[];
}

// Placeholder that mirrors a collapsed DealCard's shape, so results swap in
// without the layout jumping. Pulses (unless the user prefers reduced motion).
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
          <div className={`mt-2 h-3 w-44 ${bar}`} />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className={`h-5 w-16 ${bar}`} />
          <div className={`h-3 w-12 ${bar}`} />
        </div>
      </div>
      <div className="mt-3 flex gap-1">
        <div className={`h-16 flex-1 ${bar}`} />
        <div className={`h-16 flex-1 ${bar}`} />
        <div className={`h-16 flex-1 ${bar}`} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <div className={`h-7 w-28 rounded-full ${bar}`} />
        <div className="flex gap-3">
          <div className={`h-4 w-10 ${bar}`} />
          <div className={`h-4 w-12 ${bar}`} />
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
  loading,
  error,
  emptyMessage,
  cheapest,
  groupByMonth = false,
  onClearFilters,
}: {
  deals: Deal[];
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
  cheapest?: { style: WeekendStyle; months: number; direct: boolean; adults: number };
  groupByMonth?: boolean;
  onClearFilters?: () => void;
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
    />
  );

  if (!groupByMonth) {
    return <div className="flex flex-col gap-3">{deals.map(card)}</div>;
  }

  // Each month is its own section so the sticky header leaves with its run
  // instead of piling up under the previous one.
  return (
    <div className="flex flex-col gap-3">
      {toSections(deals).map((section) => (
        <section key={section.key} className="flex flex-col gap-3">
          <div className="sticky top-0 z-10 flex items-baseline gap-2 bg-background/85 pb-1 pt-1 backdrop-blur-sm">
            <span className="text-sm font-semibold tracking-tight">
              {section.title}
            </span>
            <span className="text-xs text-black/40 dark:text-white/40">
              {section.deals.length}
            </span>
          </div>
          {section.deals.map(card)}
        </section>
      ))}
    </div>
  );
}
