import type { Deal } from "@/lib/deals";

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-black/10 dark:border-white/10 p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl" aria-hidden>
          {deal.flag}
        </span>
        <div>
          <div className="font-medium">{deal.cityTo}</div>
          <div className="text-sm opacity-70">{deal.countryTo}</div>
          <div className="text-sm opacity-70">
            {deal.dateOut} → {deal.dateBack} · {deal.nights}{" "}
            {deal.nights === 1 ? "night" : "nights"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-semibold">
          {deal.price} {deal.currency}
        </div>
        <a
          href={deal.deepLink}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm underline"
        >
          Book
        </a>
      </div>
    </div>
  );
}
