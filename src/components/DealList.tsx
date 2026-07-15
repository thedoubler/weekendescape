import type { Deal } from "@/lib/deals";
import type { WeekendStyle } from "@/lib/weekend";
import { DealCard } from "@/components/DealCard";

export function DealList({
  deals,
  loading,
  error,
  emptyMessage,
  cheapest,
}: {
  deals: Deal[];
  loading: boolean;
  error: string | null;
  emptyMessage?: string;
  cheapest?: { style: WeekendStyle; months: number };
}) {
  if (loading) return <p className="opacity-70">Searching for escapes…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (deals.length === 0)
    return (
      <p className="opacity-70">
        {emptyMessage ??
          "No weekend escapes found — try the Loose style or a longer timeline."}
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {deals.map((deal, i) => (
        <DealCard
          key={`${deal.cityTo}-${deal.outDepart}-${i}`}
          deal={deal}
          cheapest={cheapest}
        />
      ))}
    </div>
  );
}
