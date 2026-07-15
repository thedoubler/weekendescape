"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";
import type { Deal } from "@/lib/deals";
import { type SortKey, sortDeals, monthsOf, filterByMonths } from "@/lib/sort";
import { loadHome, saveHome } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MonthFilter } from "@/components/MonthFilter";
import { DealList } from "@/components/DealList";

const STYLE_OPTIONS = [
  { value: "strict" as WeekendStyle, label: "Strict" },
  { value: "frimon" as WeekendStyle, label: "Fri–Mon" },
  { value: "loose" as WeekendStyle, label: "Loose" },
];
const MONTH_OPTIONS = [
  { value: 1, label: "1m" },
  { value: 2, label: "2m" },
  { value: 3, label: "3m" },
  { value: 6, label: "6m" },
];
const SORT_OPTIONS = [
  { value: "soonest" as SortKey, label: "Soonest" },
  { value: "cheapest" as SortKey, label: "Cheapest" },
];

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [sort, setSort] = useState<SortKey>("soonest");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const bootstrapped = useRef(false);

  async function runSearch(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setHome(c);
    saveHome(c);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const qs = new URLSearchParams({
        flyFrom: c,
        style,
        months: String(months),
      });
      const res = await fetch(`/api/weekends?${qs.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setRawDeals(body.deals ?? []);
      setSelectedMonths([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
      setRawDeals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    const fallback = () => {
      const saved = loadHome();
      if (saved) runSearch(saved);
    };

    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const body = res.ok ? await res.json() : null;
          const code = body?.airports?.[0]?.code;
          if (code) runSearch(code);
          else fallback();
        } catch {
          fallback();
        }
      },
      fallback
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!bootstrapped.current || !home) return;
    runSearch(home);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style, months]);

  const available = useMemo(() => monthsOf(rawDeals), [rawDeals]);
  const visible = useMemo(
    () => sortDeals(filterByMonths(rawDeals, selectedMonths), sort),
    [rawDeals, selectedMonths, sort]
  );

  function toggleMonth(m: string) {
    setSelectedMonths((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
    );
  }

  return (
    <main className="max-w-2xl mx-auto p-6 flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-semibold">Weekend Escape</h1>
        <p className="opacity-70">The cheapest weekend getaways from home.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={home}
          onChange={(e) => setHome(e.target.value)}
          onBlur={() => runSearch(home)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch(home);
          }}
          placeholder="Home airport (e.g. BCN)"
          className="w-40 rounded-lg border border-black/15 dark:border-white/15 px-3 py-2 bg-transparent"
        />
        <SegmentedControl
          options={STYLE_OPTIONS}
          value={style}
          onChange={setStyle}
          ariaLabel="Weekend style"
        />
        <SegmentedControl
          options={MONTH_OPTIONS}
          value={months}
          onChange={setMonths}
          ariaLabel="Timeline"
        />
        <SegmentedControl
          options={SORT_OPTIONS}
          value={sort}
          onChange={setSort}
          ariaLabel="Sort"
        />
      </div>

      {available.length > 0 && (
        <MonthFilter
          months={available}
          selected={selectedMonths}
          onToggle={toggleMonth}
          onClear={() => setSelectedMonths([])}
        />
      )}

      {searched && (
        <DealList
          deals={visible}
          loading={loading}
          error={error}
          emptyMessage={
            selectedMonths.length > 0
              ? "No deals in the selected months."
              : undefined
          }
        />
      )}
    </main>
  );
}
