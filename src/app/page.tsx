"use client";

import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";
import { type Deal, isShortStay } from "@/lib/deals";
import {
  type SortKey,
  sortDeals,
  monthsOf,
  filterByMonths,
  priceRange,
  filterByMaxPrice,
} from "@/lib/sort";
import {
  continentOf,
  continentsOf,
  filterByContinents,
} from "@/lib/continents";
import { monthShort } from "@/lib/format";
import { priceBuckets } from "@/lib/price";
import { loadHome, saveHome } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AirportInput } from "@/components/AirportInput";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
import { PriceFilter } from "@/components/PriceFilter";
import { FilterChip } from "@/components/FilterChip";
import { DealList, SkeletonCard } from "@/components/DealList";

// Fetch that aborts after `ms` so a stalled request (slow upstream, a dropped
// tunnel connection) fails into a retryable error instead of spinning forever.
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

const STYLE_OPTIONS = [
  { value: "strict" as WeekendStyle, label: "Fri–Sun" },
  { value: "frimon" as WeekendStyle, label: "Fri–Mon" },
  { value: "loose" as WeekendStyle, label: "Thu–Mon" },
];
const MONTH_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 6, label: "6" },
];
const STOP_OPTIONS = [
  { value: "any" as StopMode, label: "Any" },
  { value: "direct" as StopMode, label: "Direct" },
];
const ADULTS_OPTIONS = [
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
  { value: 4, label: "4" },
];
type StopMode = "any" | "direct";

// "just now" / "3 min ago" / "2 h ago" — for the price-freshness stamp.
function agoLabel(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return `${h} h ago`;
}

function Field({
  label,
  hint,
  align = "start",
  children,
}: {
  label: string;
  hint?: string;
  align?: "start" | "end" | "stretch";
  children: ReactNode;
}) {
  const alignClass =
    align === "end"
      ? "items-end"
      : align === "stretch"
        ? "items-stretch"
        : "items-start";
  return (
    <div className={`flex min-w-0 flex-col ${alignClass}`}>
      <span className="mb-1 text-xs font-medium text-black/60 dark:text-white/60">
        {label}
      </span>
      {children}
      {hint && (
        <span className="mt-1 text-xs text-black/40 dark:text-white/40">
          {hint}
        </span>
      )}
    </div>
  );
}

// One tappable facet in the collapsed summary — the dotted underline signals it
// can be edited (Airbnb-style: each part of the query is its own edit target).
function FacetButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="-mx-0.5 rounded px-1 underline decoration-dotted decoration-black/25 underline-offset-4 transition hover:bg-black/[0.06] hover:decoration-black/60 dark:decoration-white/25 dark:hover:bg-white/[0.10] dark:hover:decoration-white/60"
    >
      {children}
    </button>
  );
}

export default function Home() {
  const [home, setHome] = useState("");
  const [style, setStyle] = useState<WeekendStyle>("frimon");
  const [months, setMonths] = useState(3);
  const [stopMode, setStopMode] = useState<StopMode>("direct");
  const [adults, setAdults] = useState(1);
  // Opt-in "bridge days" mode — off by default (a plain search). When on, the
  // API runs the holiday-anchored searches and returns only long-weekend escapes.
  const [bridges, setBridges] = useState(false);
  const [sort, setSort] = useState<SortKey>("cheapest");
  const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
  const [selectedContinents, setSelectedContinents] = useState<string[]>([]);
  const [maxPrice, setMaxPrice] = useState(0);
  const [rawDeals, setRawDeals] = useState<Deal[]>([]);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [showRefine, setShowRefine] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [showJump, setShowJump] = useState(false);
  // First-load only: while we detect location + run the initial search, show a
  // quiet spinner instead of the empty form, so the UI doesn't flash the
  // expanded panel and then snap it shut when results arrive.
  const [booting, setBooting] = useState(true);
  const bootstrapped = useRef(false);
  const didAutoCollapse = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Mirror the current filter values into refs so runSearch (called from effects
  // and callbacks) always reads the latest, without being a dependency.
  const styleRef = useRef(style);
  const monthsRef = useRef(months);
  const stopModeRef = useRef(stopMode);
  const adultsRef = useRef(adults);
  const bridgesRef = useRef(bridges);
  useEffect(() => {
    styleRef.current = style;
    monthsRef.current = months;
    stopModeRef.current = stopMode;
    adultsRef.current = adults;
    bridgesRef.current = bridges;
  });

  async function runSearch(code: string) {
    const c = code.trim().toUpperCase();
    if (!c) return;
    setHome(c);
    saveHome(c);
    setLoading(true);
    setError(null);
    setSearched(true);
    setBooting(false);
    // Collapse the panel as the first search begins (not after it resolves) so
    // results fill in place rather than the panel snapping shut beneath them.
    if (!didAutoCollapse.current) {
      didAutoCollapse.current = true;
      setCollapsed(true);
    }
    try {
      const qs = new URLSearchParams({
        flyFrom: c,
        style: styleRef.current,
        months: String(monthsRef.current),
        adults: String(adultsRef.current),
      });
      if (stopModeRef.current === "direct") qs.set("direct", "1");
      if (bridgesRef.current) qs.set("bridges", "1");
      const res = await fetchWithTimeout(`/api/weekends?${qs.toString()}`, 20000);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setRawDeals(body.deals ?? []);
      setFetchedAt(body.fetchedAt ?? Date.now());
      setSelectedMonths([]);
    } catch (e) {
      const timedOut = e instanceof DOMException && e.name === "AbortError";
      setError(
        timedOut
          ? "Search timed out — check your connection and try again."
          : e instanceof Error
            ? e.message
            : "Search failed"
      );
      setRawDeals([]);
    } finally {
      setLoading(false);
    }
  }

  function detectLocation() {
    const fallback = () => {
      const saved = loadHome();
      if (saved) runSearch(saved);
      else {
        // No location and nothing saved — reveal the form for manual entry.
        // Focus after the form has actually rendered (it isn't mounted while
        // the boot spinner is showing).
        setBooting(false);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
    };
    if (!navigator.geolocation) {
      fallback();
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const res = await fetchWithTimeout(
          `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          8000
        );
        const body = res.ok ? await res.json() : null;
        const code = body?.airports?.[0]?.code;
        if (code) runSearch(code);
        else fallback();
      } catch {
        fallback();
      }
    }, fallback, { timeout: 8000 });
  }

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    // A shared/bookmarked link (?from=BCN&style=..&months=..&direct=1) wins over
    // geolocation so the board reproduces exactly.
    const p = new URLSearchParams(window.location.search);
    const from = (p.get("from") || "").trim().toUpperCase();
    if (from) {
      const s = p.get("style");
      const m = Number(p.get("months"));
      const style0: WeekendStyle = (["strict", "frimon", "loose"] as const).includes(
        s as WeekendStyle
      )
        ? (s as WeekendStyle)
        : "frimon";
      const months0 = [1, 2, 3, 6].includes(m) ? m : 3;
      // Direct is the default now; an explicit direct=0 opts back into stops.
      const stop0: StopMode = p.get("direct") === "0" ? "any" : "direct";
      const a = Number(p.get("adults"));
      const adults0 = [1, 2, 3, 4].includes(a) ? a : 1;
      const bridges0 = p.get("bridges") === "1";
      // Seed refs synchronously so the immediate search uses the URL values
      // (state setters haven't flushed yet). Only guard the param-change effect
      // if a non-default value actually changed.
      styleRef.current = style0;
      monthsRef.current = months0;
      stopModeRef.current = stop0;
      adultsRef.current = adults0;
      bridgesRef.current = bridges0;
      setStyle(style0);
      setMonths(months0);
      setStopMode(stop0);
      setAdults(adults0);
      setBridges(bridges0);
      runSearch(from);
    } else {
      detectLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Changing the trip options no longer auto-searches — the Search button in the
  // panel is the single trigger, so a network round-trip is always intentional.

  // Keep the URL in sync with the active search so it's shareable/bookmarkable.
  useEffect(() => {
    if (!searched || !home) return;
    const p = new URLSearchParams();
    p.set("from", home);
    if (style !== "frimon") p.set("style", style);
    if (months !== 3) p.set("months", String(months));
    if (stopMode === "any") p.set("direct", "0");
    if (adults !== 1) p.set("adults", String(adults));
    if (bridges) p.set("bridges", "1");
    const qs = p.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `?${qs}` : window.location.pathname
    );
  }, [home, style, months, stopMode, adults, bridges, searched]);

  // Show a "back to controls" pill once the user scrolls deep into the list, so
  // sort/refine stay reachable without scrolling to the top (our month dividers
  // are already sticky, so we avoid a second sticky bar that would overlap them).
  useEffect(() => {
    const onScroll = () => {
      // Hide near the bottom so it never overlaps the end-of-list CTA.
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 220;
      setShowJump(window.scrollY > 700 && !nearBottom);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const available = useMemo(() => monthsOf(rawDeals), [rawDeals]);
  const availableContinents = useMemo(
    () => continentsOf(rawDeals),
    [rawDeals]
  );
  const bounds = useMemo(() => priceRange(rawDeals), [rawDeals]);
  // Reset the price cap to "show everything" whenever a new search lands.
  useEffect(() => {
    setMaxPrice(bounds.max);
  }, [bounds.max]);
  const cap = maxPrice > 0 ? maxPrice : bounds.max;
  const filtered = useMemo(() => {
    let out = filterByMonths(rawDeals, selectedMonths);
    out = filterByContinents(out, selectedContinents);
    out = filterByMaxPrice(out, cap);
    return sortDeals(out, sort);
  }, [rawDeals, selectedMonths, selectedContinents, cap, sort]);
  // Layover trips with under a day at the destination are hidden by default.
  const hiddenCount = useMemo(
    () => filtered.filter(isShortStay).length,
    [filtered]
  );
  const visible = showHidden
    ? filtered
    : filtered.filter((d) => !isShortStay(d));

  // Per-option counts for the Refine pills, over the base universe the user can
  // actually see (respecting the short-stay toggle) but ignoring month/region/
  // price selections — so each pill shows how many trips it would surface.
  const countable = useMemo(
    () =>
      showHidden ? rawDeals : rawDeals.filter((d) => !isShortStay(d)),
    [rawDeals, showHidden]
  );
  const continentCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const d of countable) {
      const c = continentOf(d.countryToCode);
      if (c) m[c] = (m[c] ?? 0) + 1;
    }
    return m;
  }, [countable]);
  const currency = rawDeals[0]?.currency ?? "EUR";
  const priceBucketList = useMemo(
    () => priceBuckets(rawDeals.map((d) => d.price)),
    [rawDeals]
  );

  function clearAll() {
    setSelectedMonths([]);
    setSelectedContinents([]);
    setMaxPrice(bounds.max);
    setShowHidden(false);
  }

  const editSearch = () => setCollapsed(false);
  const editFrom = () => {
    setCollapsed(false);
    setTimeout(() => inputRef.current?.focus(), 60);
  };

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

  const hasRefinements =
    available.length > 0 ||
    availableContinents.length > 1 ||
    priceBucketList.length > 0 ||
    hiddenCount > 0;
  const activeFilters =
    selectedMonths.length +
    selectedContinents.length +
    (cap < bounds.max ? 1 : 0);
  const styleLabel =
    STYLE_OPTIONS.find((o) => o.value === style)?.label ?? style;
  // The next-larger search window, for the end-of-list "look further ahead" CTA.
  const nextWindow = MONTH_OPTIONS.find((o) => o.value > months)?.value;

  // Widen the search window a tier and fold the wider results into the list in
  // place — no skeleton takeover, no scroll jump — so it reads as "load more".
  async function widenWindow() {
    if (!nextWindow || !home || loadingMore) return;
    const next = nextWindow;
    monthsRef.current = next;
    setMonths(next);
    setLoadingMore(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        flyFrom: home,
        style: styleRef.current,
        months: String(next),
        adults: String(adultsRef.current),
      });
      if (stopModeRef.current === "direct") qs.set("direct", "1");
      if (bridgesRef.current) qs.set("bridges", "1");
      const res = await fetchWithTimeout(`/api/weekends?${qs.toString()}`, 20000);
      const body = await res.json();
      if (res.ok) {
        setRawDeals(body.deals ?? []);
        setFetchedAt(body.fetchedAt ?? Date.now());
      }
    } catch {
      /* keep the current list on failure */
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto w-full min-w-0 p-4 sm:p-6 flex flex-col gap-6">
      <header className="flex items-start gap-2.5 border-b border-black/[0.07] pb-4 dark:border-white/10">
        {/* Mark: a sparkle with a detached "destination dot". The badge inverts
            by theme so the warm accent is always present but never floods. */}
        <span
          aria-hidden
          className="mt-[3px] grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-neutral-900 text-[#f97316] dark:bg-[#f97316] dark:text-[#14161c]"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-[18px] w-[18px]">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
            <circle cx="19.6" cy="4.4" r="1.7" />
          </svg>
        </span>
        <div className="leading-tight">
          {/* "Weekend" native sans, "Escape" serif-italic for lift. */}
          <h1 className="text-2xl leading-[0.95] tracking-[-0.01em] sm:text-[28px]">
            <span className="font-semibold">Weekend</span>{" "}
            <span className="relative inline-block font-serif italic">
              Escape
              {/* Signature motif: a dotted flight-path arc rising under the word. */}
              <svg
                aria-hidden
                viewBox="0 0 100 8"
                preserveAspectRatio="none"
                fill="none"
                className="pointer-events-none absolute inset-x-0 -bottom-[3px] h-[7px] w-full overflow-visible"
              >
                <path
                  d="M2 6.5 Q 50 0.5 98 3"
                  stroke="#f97316"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeDasharray="0.1 13"
                  vectorEffect="non-scaling-stroke"
                  opacity="0.7"
                />
              </svg>
            </span>
          </h1>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-black/50 dark:text-white/55">
            Est. cheapest weekends
          </p>
        </div>
      </header>

      {booting ? (
        /* First load: explain the tool + what's happening (we're detecting the
           nearest airport, which may prompt for location), then the same
           skeletons as a search for one consistent loading state. */
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-black/[0.07] bg-black/[0.015] p-4 text-sm dark:border-white/10 dark:bg-white/[0.02]">
            <p className="text-black/70 dark:text-white/70">
              The cheapest round-trip{" "}
              <span className="font-medium">weekend flights</span> from your home
              airport — tap a deal to book on Kiwi. Prices are live estimates.
            </p>
            <p className="mt-1.5 text-black/55 dark:text-white/60">
              📍 Finding your nearest airport… we only use your location for
              this — or type it in below.
            </p>
          </div>
          <div
            className="flex flex-col gap-3"
            aria-busy="true"
            aria-label="Finding weekend escapes"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      ) : (
      <div className="flex flex-col gap-6 animate-fade-in">
      {collapsed ? (
        /* Compact summary once searched — each facet is individually tappable */
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-black/[0.07] bg-black/[0.015] px-4 py-3 dark:border-white/10 dark:bg-white/[0.02]">
          <div className="min-w-0">
            <div className="text-xs text-black/45 dark:text-white/45">
              Weekend getaways from
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 font-medium">
              <FacetButton onClick={editFrom}>{home}</FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>{styleLabel}</FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                next {months} month{months === 1 ? "" : "s"}
              </FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                {stopMode === "direct" ? "Direct" : "Any stops"}
              </FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                {adults} adult{adults === 1 ? "" : "s"}
              </FacetButton>
              {bridges && (
                <>
                  <span className="text-black/25 dark:text-white/25">·</span>
                  <FacetButton onClick={editSearch}>🌉 Bridge days</FacetButton>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={editSearch}
            className="shrink-0 rounded-lg border border-black/15 px-3 py-1.5 text-sm text-black/70 transition duration-200 hover:bg-black/[0.04] motion-safe:hover:scale-105 dark:border-white/20 dark:text-white/70 dark:hover:bg-white/[0.06]"
          >
            Edit
          </button>
        </div>
      ) : (
        /* Full search — set the trip, then hit Search (the only trigger) */
        <section className="flex flex-col gap-5 rounded-2xl border border-black/[0.07] bg-black/[0.015] p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.02]">
          {!searched && (
            <p className="text-sm text-black/60 dark:text-white/65">
              Cheapest round-trip weekend flights from your home airport — tap a
              deal to book on Kiwi.
            </p>
          )}
          {/* Origin — the primary input, given room to breathe */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-black/60 dark:text-white/60">
                Flying from
              </span>
              <button
                type="button"
                onClick={detectLocation}
                className="group text-xs text-black/55 transition hover:text-black dark:text-white/55 dark:hover:text-white"
              >
                <span aria-hidden>📍</span>{" "}
                <span className="underline-offset-2 group-hover:underline">
                  Find my airport
                </span>
              </button>
            </div>
            <AirportInput
              value={home}
              onSearch={(code) => setHome(code.trim().toUpperCase())}
              inputRef={inputRef}
            />
          </div>

          <div className="h-px bg-black/[0.06] dark:bg-white/[0.08]" />

          {/* When & how — refinements to the trip */}
          <div className="flex flex-wrap gap-x-6 gap-y-5">
            <Field label="Weekend length">
              <SegmentedControl
                options={STYLE_OPTIONS}
                value={style}
                onChange={setStyle}
                ariaLabel="Weekend length"
              />
            </Field>
            <Field label="Months ahead">
              <SegmentedControl
                options={MONTH_OPTIONS}
                value={months}
                onChange={setMonths}
                ariaLabel="Timeline"
              />
            </Field>
            <Field label="Stops" hint="Direct = nonstop only">
              <SegmentedControl
                options={STOP_OPTIONS}
                value={stopMode}
                onChange={setStopMode}
                ariaLabel="Stops"
              />
            </Field>
            <Field label="Adults">
              <SegmentedControl
                options={ADULTS_OPTIONS}
                value={adults}
                onChange={setAdults}
                ariaLabel="Adults"
              />
            </Field>
          </div>

          {/* Opt-in bridge-days mode — off by default (a plain search). */}
          <button
            type="button"
            role="switch"
            aria-checked={bridges}
            onClick={() => setBridges((v) => !v)}
            className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors ${
              bridges
                ? "border-amber-300 bg-amber-100/70 dark:border-amber-300/40 dark:bg-amber-300/15"
                : "border-black/10 bg-black/[0.015] hover:bg-black/[0.03] dark:border-white/10 dark:bg-white/[0.02] dark:hover:bg-white/[0.05]"
            }`}
          >
            <span aria-hidden className="text-xl leading-none">
              🌉
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                Hunt for bridge days
              </span>
              <span className="block text-xs text-black/50 dark:text-white/50">
                Only long weekends — where a public holiday means one day off (or
                none) buys you three or four.
              </span>
            </span>
            <span
              className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
                bridges
                  ? "bg-amber-500 dark:bg-amber-400"
                  : "bg-black/15 dark:bg-white/20"
              }`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
                  bridges ? "left-[18px]" : "left-0.5"
                }`}
              />
            </span>
          </button>

          <div className="flex items-center justify-end gap-4">
            {searched && (
              <button
                type="button"
                onClick={() => setCollapsed(true)}
                className="text-sm text-black/55 hover:text-black dark:text-white/55 dark:hover:text-white"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={!home.trim()}
              onClick={() => {
                runSearch(home);
                setCollapsed(true);
              }}
              className="rounded-full bg-neutral-900 px-6 py-2 text-sm font-medium text-white transition duration-200 hover:opacity-90 disabled:opacity-40 motion-safe:enabled:hover:scale-105 dark:bg-white dark:text-black"
            >
              {searched ? "Update search" : "Search"}
            </button>
          </div>
        </section>
      )}

      {/* Results header — primary: what you're seeing + how it's ordered */}
      {searched && (
        <div className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex flex-col">
              <span className="text-lg font-semibold tracking-tight">
                {loading
                  ? "Searching…"
                  : error
                    ? "Couldn’t load results"
                    : `${visible.length} ${bridges ? "bridge" : "weekend"} escape${
                        visible.length === 1 ? "" : "s"
                      }`}
              </span>
              {!loading && !error && fetchedAt && visible.length > 0 && (
                <span className="text-[11px] text-black/55 dark:text-white/60">
                  Checked {agoLabel(fetchedAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-black/45 dark:text-white/45">
                Sort
              </span>
              <SegmentedControl
                options={[
                  { value: "soonest" as SortKey, label: "Soonest" },
                  { value: "cheapest" as SortKey, label: "Cheapest" },
                ]}
                value={sort}
                onChange={setSort}
                ariaLabel="Sort"
              />
              {!loading && !error && hasRefinements && (
                <button
                  type="button"
                  onClick={() => setShowRefine((v) => !v)}
                  aria-expanded={showRefine}
                  className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-black/15 px-3 py-1 text-sm text-black/70 transition duration-200 hover:bg-black/5 motion-safe:hover:scale-105 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Refine
                  {activeFilters > 0 && (
                    <span className="rounded-full bg-neutral-900 px-1.5 text-xs text-white dark:bg-white dark:text-black">
                      {activeFilters}
                    </span>
                  )}
                  <span aria-hidden>{showRefine ? "▴" : "▾"}</span>
                </button>
              )}
            </div>
          </div>
          {/* Secondary: active filters as removable chips, so filter state
              stays visible while the Refine panel is closed. */}
          {!loading && !error && hasRefinements && activeFilters > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {selectedMonths.map((m) => (
                <FilterChip
                  key={m}
                  label={monthShort(m)}
                  onRemove={() => toggleMonth(m)}
                />
              ))}
              {selectedContinents.map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  onRemove={() => toggleContinent(c)}
                />
              ))}
              {cap < bounds.max && (
                <FilterChip
                  label={`≤ ${cap} ${currency}`}
                  onRemove={() => setMaxPrice(bounds.max)}
                />
              )}
              <button
                type="button"
                onClick={clearAll}
                className="ml-0.5 text-sm text-black/50 underline underline-offset-2 hover:text-black/80 dark:text-white/50 dark:hover:text-white/80"
              >
                Clear all
              </button>
            </div>
          )}
        </div>
      )}

      {/* Refine — instant client-side filters; same visual language as the
          trip panel, but these narrow the loaded results without re-searching. */}
      {searched && showRefine && hasRefinements && (
        <div className="flex flex-col gap-5 rounded-2xl border border-black/[0.07] bg-black/[0.015] p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.02]">
          <p className="text-xs text-black/45 dark:text-white/45">
            Narrows the results below instantly — no new search.
          </p>
          {available.length > 0 && (
            <Field label="Month" align="stretch">
              <MonthFilter
                months={available}
                selected={selectedMonths}
                onToggle={toggleMonth}
                onClear={() => setSelectedMonths([])}
              />
            </Field>
          )}
          {availableContinents.length > 1 && (
            <Field label="Region" align="stretch">
              <ContinentFilter
                continents={availableContinents}
                selected={selectedContinents}
                counts={continentCounts}
                onToggle={toggleContinent}
                onClear={() => setSelectedContinents([])}
              />
            </Field>
          )}
          {priceBucketList.length > 0 && (
            <Field label="Max price" align="stretch">
              <PriceFilter
                buckets={priceBucketList}
                max={bounds.max}
                value={cap}
                currency={currency}
                onChange={setMaxPrice}
              />
            </Field>
          )}
          {hiddenCount > 0 && (
            <Field label="Short-stay trips" align="stretch">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!showHidden}
                  onChange={() => setShowHidden((v) => !v)}
                  className="mt-0.5 accent-black dark:accent-white"
                />
                <span className="text-black/70 dark:text-white/70">
                  Hide {hiddenCount} trip{hiddenCount === 1 ? "" : "s"} with
                  under a day at the destination — more travel than time there.
                </span>
              </label>
            </Field>
          )}
        </div>
      )}

      {searched && (
        <DealList
          deals={visible}
          loading={loading}
          error={error}
          groupByMonth={sort === "soonest"}
          cheapest={{ style, months, direct: stopMode === "direct", adults }}
          splitShape={bridges ? undefined : style}
          onClearFilters={activeFilters > 0 ? clearAll : undefined}
          emptyMessage={
            selectedMonths.length > 0 ||
            selectedContinents.length > 0 ||
            cap < bounds.max
              ? "No escapes match these filters — try widening them."
              : rawDeals.length === 0
                ? bridges
                  ? `No bridge-day escapes from ${home || "that airport"} in this window — try a longer window, or turn off "Hunt for bridge days".`
                  : `No weekend routes found from ${home || "that airport"} — try a longer window or a different airport.`
                : undefined
          }
        />
      )}

      {/* End-of-list escape hatch: widen the search window without re-opening
          Edit. Keeps the current trip options; the client filters carry over. */}
      {searched && !loading && !error && loadingMore && (
        <div
          className="flex flex-col gap-3"
          aria-busy="true"
          aria-label="Loading more escapes"
        >
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}
      {searched && !loading && !error && !loadingMore && nextWindow && (
        <div className="flex flex-col items-center gap-1.5 pt-1 pb-2 text-center">
          <button
            type="button"
            onClick={widenWindow}
            className="inline-flex items-center gap-2 rounded-full border border-black/15 px-5 py-2.5 text-sm font-medium text-black/75 transition duration-200 hover:bg-black/[0.04] motion-safe:hover:scale-[1.03] dark:border-white/15 dark:text-white/75 dark:hover:bg-white/[0.06]"
          >
            Search the next {nextWindow} months
            <span aria-hidden>→</span>
          </button>
          <span className="text-xs text-black/55 dark:text-white/60">
            Look further ahead for more escapes
          </span>
        </div>
      )}
      {/* Terminal state at the widest window, so the list has a definite bottom. */}
      {searched && !loading && !error && !loadingMore && !nextWindow &&
        visible.length > 0 && (
          <p className="pt-1 pb-2 text-center text-xs text-black/55 dark:text-white/60">
            That’s every weekend in the next {months} months.
          </p>
        )}
      </div>
      )}

      {searched && showJump && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-5 left-4 z-30 rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg transition duration-200 hover:opacity-90 motion-safe:hover:scale-105 dark:bg-white dark:text-black"
        >
          ↑ Sort &amp; filter
        </button>
      )}
    </main>
  );
}
