import type { Deal } from "@/lib/deals";
import { DealCard } from "@/components/DealCard";

export function DealList({
  deals,
  loading,
  error,
}: {
  deals: Deal[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) return <p className="opacity-70">Searching for escapes…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (deals.length === 0)
    return (
      <p className="opacity-70">
        No cheap weekend deals found — try the Loose style or a longer timeline.
      </p>
    );

  return (
    <div className="flex flex-col gap-3">
      {deals.map((deal, i) => (
        <DealCard key={`${deal.cityTo}-${deal.dateOut}-${i}`} deal={deal} />
      ))}
    </div>
  );
}
