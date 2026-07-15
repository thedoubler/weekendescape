"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";
import type { Deal } from "@/lib/deals";
import { type SortKey, sortDeals, monthsOf, filterByMonths } from "@/lib/sort";
import { continentsOf, filterByContinents } from "@/lib/continents";
import { loadHome, saveHome } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
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
  const [selectedContinents, setSelectedContinents] = useState<string[]>([]);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const bootstrapped = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastSearched = useRef("");
  const styleRef = useRef(style);
  styleRef.current = style;
  const monthsRef = useRef(months);
  monthsRef.current = months;

  async function runSearch(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    lastSearched.current = c;
    setHome(c);
    saveHome(c);
    setLoading(true);
    setError(null);
    setSearched(true);
    try {
      const qs = new URLSearchParams({
        flyFrom: c,
        style: styleRef.current,
        months: String(monthsRef.current),
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
      else inputRef.current?.focus();
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
  const availableContinents = useMemo(
    () => continentsOf(rawDeals),
    [rawDeals]
  );
  const visible = useMemo(
    () =>
      sortDeals(
        filterByContinents(
          filterByMonths(rawDeals, selectedMonths),
          selectedContinents
        ),
        sort
      ),
    [rawDeals, selectedMonths, selectedContinents, sort]
  );

  function toggleMonth(m: string) {
    setSelectedMonths((cur) =>
      cur.includes(m) ? cur.filter((x) => x !== m) : [...cur, m]
    );
  }

  function toggleContinent(c: string) {
    setSelectedContinents((cur) =>
      cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]
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
          ref={inputRef}
          value={home}
          onChange={(e) => setHome(e.target.value)}
          onBlur={() => {
            if (home.trim().toUpperCase() !== lastSearched.current) runSearch(home);
          }}
          onKeyDown={(e) => {
            if (
              e.key === "Enter" &&
              home.trim().toUpperCase() !== lastSearched.current
            )
              runSearch(home);
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

      {availableContinents.length > 1 && (
        <ContinentFilter
          continents={availableContinents}
          selected={selectedContinents}
          onToggle={toggleContinent}
          onClear={() => setSelectedContinents([])}
        />
      )}

      {searched && (
        <DealList
          deals={visible}
          loading={loading}
          error={error}
          cheapest={{ style, months }}
          emptyMessage={
            selectedMonths.length > 0 || selectedContinents.length > 0
              ? "No deals match these filters."
              : undefined
          }
        />
      )}
    </main>
  );
}
