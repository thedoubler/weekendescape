"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { WeekendStyle } from "@/lib/weekend";
import { type Deal, isShortStay, dealDomId } from "@/lib/deals";
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
import { loadHomes, saveHomes } from "@/lib/home-storage";
import { SegmentedControl } from "@/components/SegmentedControl";
import { AirportInput } from "@/components/AirportInput";
import {
  MAX_ORIGINS,
  parseOrigins,
  serializeOrigins,
  addOrigin,
  removeOrigin,
} from "@/lib/origins";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
import { PriceFilter } from "@/components/PriceFilter";
import { FilterChip } from "@/components/FilterChip";
import { DealList, SkeletonCard } from "@/components/DealList";
import { DealsMap } from "@/components/DealsMap";
import { RotatingWord } from "@/components/RotatingWord";
import OverflowDebug from "@/components/OverflowDebug";

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
function PencilIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
    </svg>
  );
}

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
  // One to three home airports. `home` stays as the primary for the many places
  // that only need one (map centring, "cheapest weekend" lookups).
  const [origins, setOrigins] = useState<string[]>([]);
  const home = origins[0] ?? "";
  const [style, setStyle] = useState<WeekendStyle>("strict");
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
  // Origin coordinates ship once per response (the airport table is server-only,
  // so the client can't resolve them itself).
  const [originPoints, setOriginPoints] = useState<
    { code: string; coords: [number, number] | null }[]
  >([]);
  const [showMap, setShowMap] = useState(false);
  // Destination the pointer is over in the list; the map lifts its arc out of
  // the fan. Only meaningful while the map is open, and only on pointer/focus
  // devices — a tap never sets it.
  const [hoveredTo, setHoveredTo] = useState<string | null>(null);
  // The parameters the CURRENT results were actually fetched with. The form
  // state changes the instant a user taps a chip, but the deals on screen are
  // still the previous search's — so labels, the URL and the cheapest-weekend
  // lookup must all read from here, never from the live form. Otherwise tapping
  // "2 adults" relabels every card and prints a per-person price for a fare
  // that was quoted for one.
  const [applied, setApplied] = useState<{
    origins: string[];
    style: WeekendStyle;
    months: number;
    direct: boolean;
    adults: number;
    bridges: boolean;
  } | null>(null);
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

  async function runSearch(codes: string | string[]) {
    const list = parseOrigins(
      Array.isArray(codes) ? codes.join(",") : codes
    );
    if (list.length === 0) return;
    setOrigins(list);
    saveHomes(list);
    setLoading(true);
    setError(null);
    setSearched(true);
    setBooting(false);
    // Collapse to the summary once we have an origin — but ONLY then.
    //
    // Two failure modes to thread between. Always collapsing hid every setting
    // behind an "Edit" button a newcomer had no reason to press. Never
    // collapsing left a ~500px panel between the header and the board, so the
    // first result sat below the fold for someone who already knows what this
    // is. Reaching this line means a search is running, which means we HAVE an
    // airport — so the summary is enough, and the form stays open for the
    // visitor who has no origin yet and needs to type one.
    if (!didAutoCollapse.current) {
      didAutoCollapse.current = true;
      setCollapsed(true);
    }
    try {
      const qs = new URLSearchParams({
        flyFrom: serializeOrigins(list),
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
      setOriginPoints(body.origins ?? []);
      setApplied({
        origins: list,
        style: styleRef.current,
        months: monthsRef.current,
        direct: stopModeRef.current === "direct",
        adults: adultsRef.current,
        bridges: bridgesRef.current,
      });
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
      const saved = loadHomes();
      if (saved.length) runSearch(saved);
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
    const from = serializeOrigins(parseOrigins(p.get("from")));
    if (from) {
      const s = p.get("style");
      const m = Number(p.get("months"));
      const style0: WeekendStyle = (["strict", "frimon", "loose"] as const).includes(
        s as WeekendStyle
      )
        ? (s as WeekendStyle)
        : "strict";
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
      // Deliberately an effect. `/` is prerendered as static content, so this
      // component renders on the server at build time — reading
      // window.location from a render-phase state initialiser would throw
      // there. Seeding from the URL can only happen after mount. Runs once,
      // guarded by `bootstrapped`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // A stable dependency for the URL sync: `origins` is a fresh array on every
  // render, but its serialised form only changes when the airports do.
  const originsParam = serializeOrigins(applied?.origins ?? []);

  // Keep the URL in sync with the active search so it's shareable/bookmarkable.
  useEffect(() => {
    if (!searched || !originsParam) return;
    const p = new URLSearchParams();
    if (!applied) return;
    p.set("from", originsParam);
    if (applied.style !== "strict") p.set("style", applied.style);
    if (applied.months !== 3) p.set("months", String(applied.months));
    if (!applied.direct) p.set("direct", "0");
    if (applied.adults !== 1) p.set("adults", String(applied.adults));
    if (applied.bridges) p.set("bridges", "1");
    const qs = p.toString();
    // Preserve history.state rather than passing null: Next keeps router
    // internals in there, and wiping them on every filter change breaks
    // back/forward (and would destroy any state marker a future modal adds).
    window.history.replaceState(
      window.history.state,
      "",
      qs ? `?${qs}` : window.location.pathname
    );
  }, [originsParam, applied, searched]);

  // Show a "back to controls" pill once the user scrolls deep into the list, so
  // sort/refine stay reachable without scrolling to the top (our month dividers
  // are already sticky, so we avoid a second sticky bar that would overlap them).
  useEffect(() => {
    // Coalesced into one rAF per frame. Reading scrollHeight forces a layout,
    // and doing that on every scroll event means laying out a 60-card list
    // dozens of times a second — on the one interaction this product is made of.
    let queued = false;
    const measure = () => {
      queued = false;
      // Hide near the bottom so it never overlaps the end-of-list CTA.
      const nearBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 220;
      setShowJump(window.scrollY > 700 && !nearBottom);
    };
    const onScroll = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(measure);
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
  // Reset the price cap to "show everything" whenever a new search lands. Done
  // during render rather than in an effect so the new cap applies in this same
  // pass — an effect commits (and paints) one frame carrying the previous
  // search's cap before correcting itself.
  const [capBounds, setCapBounds] = useState(bounds.max);
  if (capBounds !== bounds.max) {
    setCapBounds(bounds.max);
    setMaxPrice(bounds.max);
  }
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
  // Memoised: this array is a dependency of the map's marker/framing effects, so
  // a new identity on every render made opening Refine (or crossing the scroll
  // threshold) re-frame the map.
  const visible = useMemo(
    () => (showHidden ? filtered : filtered.filter((d) => !isShortStay(d))),
    [showHidden, filtered]
  );

  // Tapping a pin jumps the list to that destination's cheapest weekend and
  // opens it. The seq counter makes repeat taps on the same pin re-trigger.
  const [focusDeal, setFocusDeal] = useState<{ id: string; seq: number } | null>(
    null
  );
  const focusDestination = useCallback(
    (flyTo: string) => {
      const target = visible
        .filter((d) => d.flyTo === flyTo)
        .reduce<Deal | null>(
          (best, d) => (!best || d.price < best.price ? d : best),
          null
        );
      if (!target) return;
      const id = dealDomId(target);
      setFocusDeal((prev) => ({ id, seq: (prev?.seq ?? 0) + 1 }));
      // The card is already rendered, so this can run immediately; rAF just lets
      // the expand commit first so we centre on the final height.
      requestAnimationFrame(() => {
        document.getElementById(id)?.scrollIntoView({
          block: "center",
          behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")
            .matches
            ? "auto"
            : "smooth",
        });
      });
    },
    [visible]
  );

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
  // The summary describes the results on screen, so it reads the snapshot the
  // fetch was made with — not whatever the form is currently set to.
  // The departure country, from the results themselves — every deal carries it.
  const homeCountry = rawDeals[0]?.countryFrom || "";
  const appliedStyleLabel = applied
    ? (STYLE_OPTIONS.find((o) => o.value === applied.style)?.label ?? applied.style)
    : styleLabel;
  // The next-larger search window, for the end-of-list "look further ahead" CTA.
  const nextWindow = MONTH_OPTIONS.find((o) => o.value > months)?.value;

  // Widen the search window a tier and fold the wider results into the list in
  // place — no skeleton takeover, no scroll jump — so it reads as "load more".
  async function widenWindow() {
    if (!nextWindow || origins.length === 0 || loadingMore) return;
    const next = nextWindow;
    monthsRef.current = next;
    setMonths(next);
    setLoadingMore(true);
    setError(null);
    try {
      const qs = new URLSearchParams({
        // All origins, not just the primary — widening the window must not
        // silently narrow the airports.
        flyFrom: serializeOrigins(origins),
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
        setOriginPoints(body.origins ?? []);
        setApplied((a) => (a ? { ...a, months: next } : a));
      } else {
        // Widening failed — put the window back, or the summary would claim a
        // 6-month search over 3 months of results.
        monthsRef.current = months;
        setMonths(months);
        setError("Couldn’t widen the search — showing the previous results.");
      }
    } catch {
      monthsRef.current = months;
      setMonths(months);
      setError("Couldn’t widen the search — showing the previous results.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto w-full min-w-0 p-4 sm:p-6 flex flex-col gap-6">
      <header className="border-b border-black/[0.07] pb-4 dark:border-white/10">
        {/* One line: wordmark and descriptor share a baseline, so the header is
            a single object rather than a stacked block. Wraps only if there is
            genuinely no room. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 leading-tight">
          <h1 className="text-[26px] leading-[0.95] tracking-[-0.02em] sm:text-[32px]">
            {/* The wordmark IS the trip: a dotted flight path runs the whole
                width of the name and lands on a solid dot — the motif draws the
                product's own meaning instead of decorating around it. */}
            <span className="relative inline-block font-semibold">
              {/* The name is a portmanteau — s[ho]rt[liday] — where the
                  coloured letters spell "holiday" and "ho" is shared by both
                  words. Deliberately orange-600, not the brand #f97316: that
                  hue is 2.8:1 on white and fails even the 3:1 large-text bar,
                  whereas orange-600 clears it while still reading as the accent.
                  Dark mode flips to orange-400, which needs the lighter value
                  against a near-black ground. */}
              {/* The reveal: both orange runs start at the body colour and
                  warm into the accent a beat apart, so "ho…liday" surfaces out
                  of "short" rather than being coloured from the first frame.
                  Colour only — no movement, no reflow, so the CLS budget stays
                  zero and reduced-motion simply gets the finished state. */}
              <span aria-hidden>
                s
                <span className="wordmark-hi">ho</span>
                rt
                <span className="wordmark-hi wordmark-hi-2">liday</span>
              </span>
              {/* The word intact for assistive tech and for copy-paste. */}
              <span className="sr-only">shortliday</span>
            </span>
          </h1>
          {/* A hairline rule instead of a bullet: it sets on the baseline and
              reads as a lockup, not as punctuation. */}
          <p className="flex items-baseline gap-3 text-sm whitespace-nowrap text-black/65 dark:text-white/60">
            <span
              aria-hidden
              className="hidden h-3 w-px translate-y-[2px] bg-black/15 sm:block dark:bg-white/20"
            />
            <span className="italic">for the{" "}
            <RotatingWord
              words={[
                "spontaneous",
                "weekenders",
                "restless",
                "last-minute",
                "curious",
                "escape artists",
              ]}
              className="font-medium text-black/85 not-italic dark:text-white/90"
            />
            </span>
          </p>
        </div>
      </header>

      {/* Outside the panel on purpose. Inside it, this disappeared the moment
          the panel began collapsing by default — and it is the only sentence
          on the page that says what the product is. One line is the whole cost
          to a returning visitor. */}
      {!booting && (
        <p className="-mt-2 max-w-[58ch] text-[15px] leading-relaxed text-black/55 dark:text-white/55">
          {/* Two sentences, not one em-dashed run-on: the first is the claim,
              the second is what to do about it. The claim carries the weight —
              it is the only line on the page that says what this is, and it was
              set in the same muted grey as the instruction after it. */}
          <span className="font-medium text-black dark:text-white">
            The cheapest weekend you can fly to
          </span>{" "}
          — round-trips from your home airport, ranked by price.{" "}
          <span className="whitespace-nowrap">
            Tap a deal for the full cost.
          </span>
        </p>
      )}

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
              this. Prefer not to share it? Decline and you can type it in
              instead.
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
            {/* No caption. The line above already says what the board is, the
                Edit button marks this row as settings, and "Weekend getaways"
                was the last place still using a noun the rest of the app had
                dropped in favour of "flights". */}
            <div className="flex flex-wrap items-center gap-x-1 gap-y-0.5 font-medium">
              <FacetButton onClick={editFrom}>
                {(applied?.origins ?? origins).join(" · ")}
              </FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>{appliedStyleLabel}</FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                next {applied?.months ?? months} month
                {(applied?.months ?? months) === 1 ? "" : "s"}
              </FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                {(applied ? applied.direct : stopMode === "direct")
                  ? "Direct"
                  : "Any stops"}
              </FacetButton>
              <span className="text-black/25 dark:text-white/25">·</span>
              <FacetButton onClick={editSearch}>
                {applied?.adults ?? adults} adult
                {(applied?.adults ?? adults) === 1 ? "" : "s"}
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
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full border border-black/20 bg-white px-4 text-sm font-medium text-black shadow-sm transition duration-200 hover:border-black/35 hover:bg-black/[0.03] dark:border-white/25 dark:bg-white/[0.06] dark:text-white dark:hover:bg-white/[0.12]"
          >
            <PencilIcon className="h-3.5 w-3.5 shrink-0 opacity-70" />
            Edit
          </button>
        </div>
      ) : (
        /* Full search — set the trip, then hit Search (the only trigger) */
        <section className="flex flex-col gap-5 rounded-2xl border border-black/[0.07] bg-black/[0.015] p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.02]">
          {/* Origin — the primary input. Full width on a phone, where it needs
              every pixel; capped on desktop, where stretching a 770px field
              across the panel for at most three 3-letter codes made the most
              important control look like an afterthought. */}
          <div className="sm:max-w-xl">
            <span className="mb-1.5 block text-xs font-medium text-black/60 dark:text-white/60">
              Flying from
            </span>
            {/* "Find my airport" sits BESIDE the field, not opposite it across
                the panel: it fills the same box the field does, so putting it
                an inch away made it read as unrelated. Stacks under on a phone
                rather than stealing width from the input. */}
            {/* items-stretch, not items-center: the button then takes the
                field's height whatever the field grows to (one chip or three,
                wrapped or not), instead of being pinned at its own 30px beside
                a 53px input. */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch sm:gap-3">
              <div className="min-w-0 sm:flex-1">
            {/* One field holding up to three airports as chips. */}
            <AirportInput
              value=""
              chips={origins}
              onRemoveChip={(code) => setOrigins(removeOrigin(origins, code))}
              onSearch={(code) => setOrigins((cur) => addOrigin(cur, code))}
              disabled={origins.length >= MAX_ORIGINS}
              placeholder={
                origins.length === 0
                  ? "Airport or city, e.g. Barcelona"
                  : origins.length >= MAX_ORIGINS
                    ? `Up to ${MAX_ORIGINS} airports`
                    : "Add another…"
              }
              inputRef={inputRef}
            />
              </div>
              <button
                type="button"
                onClick={detectLocation}
                // A real control rather than muted text: it sits beside a
                // proper field now, and a 11px grey link beside it looked like
                // a caption. Uses the existing hairline-pill treatment instead
                // of inventing a seventh button variant (see task #9).
                className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl border border-black/10 px-4 text-xs font-medium text-black/70 transition hover:bg-black/[0.04] hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white"
              >
                <span aria-hidden>📍</span>
                Find my airport
              </button>
            </div>
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
            {/* A segmented control, like the other parameters. It was tried as
                a switch: that groups the two booleans neatly, but it also hides
                the alternative — "Any" stops being visible as a choice — and it
                broke the rhythm of a row where every other control shows its
                options. Only bridge days, which is genuinely opt-in extra
                behaviour rather than a parameter, keeps the switch. */}
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
                {/* Names the country. The search uses NATIONAL holidays in the
                    country you fly FROM — not the destination's — and nothing
                    on screen said so, which made the results look arbitrary
                    when a destination holiday didn't line up. */}
                Long weekends built on
                {homeCountry ? ` ${homeCountry}’s` : " your country’s"} national
                holidays — one day off (or none) buys you three or four.
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
                runSearch(origins);
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
                    : (() => {
                        // Everything here reads `applied`, never live form
                        // state: the deals on screen were fetched with the
                        // PREVIOUS settings, and reading the live values once
                        // relabelled 57 weekend results as "bridge escapes"
                        // before any search had run.
                        const isBridges = applied ? applied.bridges : bridges;
                        // The SHAPE of the trip, not the search window: the
                        // months are already stated in the summary line right
                        // above, and "Fri–Sun" is what distinguishes these
                        // results from any other flight search. Bridge mode has
                        // no fixed shape, so it names the thing itself.
                        if (isBridges) {
                          return `${visible.length} long weekend${
                            visible.length === 1 ? "" : "s"
                          }`;
                        }
                        return `${visible.length} ${appliedStyleLabel} flight${
                          visible.length === 1 ? "" : "s"
                        }`;
                      })()}
              </span>
              {!loading && !error && fetchedAt && visible.length > 0 && (
                <span className="text-[11px] text-black/55 dark:text-white/60">
                  Checked {agoLabel(fetchedAt)}
                </span>
              )}
            </div>
            {/* One line from `sm` up. Below that, Sort + two segments + Map +
                Refine is ~390px against a 288px content box, so it wraps rather
                than scrolling the whole page sideways. */}
            {/* ml-auto, not just justify-end: the parent is justify-between, so
                once this cluster wraps onto its own line it would otherwise sit
                hard left. This keeps Sort/Map/Refine right-aligned either way. */}
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2 sm:flex-nowrap">
              {/* The segmented control is self-explanatory on a phone; the word
                  only earns its width once there's room. */}
              <span className="hidden text-xs text-black/45 sm:inline dark:text-white/45">
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
              {/* Sits after Refine so opening the map never inserts anything
                  above the control you just tapped. */}
              {!loading && !error && visible.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMap((v) => !v)}
                  aria-expanded={showMap}
                  aria-controls="results-map"
                  className="relative ml-1 inline-flex items-center gap-1.5 h-9 rounded-full border border-black/15 px-3.5 text-sm text-black/70 transition duration-200 before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Map
                  <span aria-hidden>{showMap ? "▴" : "▾"}</span>
                </button>
              )}
              {!loading && !error && hasRefinements && (
                <button
                  type="button"
                  onClick={() => setShowRefine((v) => !v)}
                  aria-expanded={showRefine}
                  aria-controls="refine-panel"
                  className="relative ml-1 inline-flex items-center gap-1.5 h-9 rounded-full border border-black/15 px-3.5 text-sm text-black/70 transition duration-200 before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:bg-black/5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
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
        <div id="refine-panel" className="flex flex-col gap-5 rounded-2xl border border-black/[0.07] bg-black/[0.015] p-4 sm:p-5 dark:border-white/10 dark:bg-white/[0.02]">
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

      {/* Renders `visible` — the same array DealList gets — so every filter
          chip and price cap repaints the pins. The map deliberately does not
          filter anything itself: that would create filter state with no chip
          representing it. */}
      {searched && showMap && (
        <div id="results-map" className="flex flex-col gap-1.5">
          <DealsMap
            deals={visible}
            origins={originPoints}
            onSelect={focusDestination}
            highlight={hoveredTo}
            // Fullscreen hides the Refine panel behind the dialog, so the one
            // filter people actually reach for on a map goes onto the map.
            controls={
              available.length > 1 ? (
                <MonthFilter
                  months={available}
                  selected={selectedMonths}
                  onToggle={toggleMonth}
                  onClear={() => setSelectedMonths([])}
                />
              ) : undefined
            }
          />
          <p className="text-[11px] text-black/55 dark:text-white/55">
            Pins mark the arrival airport, which isn’t always the city centre.
          </p>
        </div>
      )}

      {searched && (
        <DealList
          deals={visible}
          focusId={focusDeal?.id}
          focusSeq={focusDeal?.seq}
          showOrigin={origins.length > 1}
          loading={loading}
          error={error}
          groupByMonth={sort === "soonest"}
          cheapest={
            applied
              ? {
                  style: applied.style,
                  months: applied.months,
                  direct: applied.direct,
                  adults: applied.adults,
                }
              : undefined
          }
          splitShape={
            (applied ? applied.bridges : bridges)
              ? undefined
              : (applied?.style ?? style)
          }
          onClearFilters={activeFilters > 0 ? clearAll : undefined}
          // Only while the map is on screen: otherwise every card in a 60-row
          // list would set state on mouse-move for nothing to look at.
          onHover={showMap ? setHoveredTo : undefined}
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
            Extend to {nextWindow} months
            <span aria-hidden>→</span>
          </button>
          <span className="text-xs text-black/55 dark:text-white/60">
            Currently showing the next {applied?.months ?? months} month
            {months === 1 ? "" : "s"}
          </span>
        </div>
      )}
      {/* Terminal state at the widest window, so the list has a definite bottom. */}
      {searched && !loading && !error && !loadingMore && !nextWindow &&
        visible.length > 0 && (
          <p className="pt-1 pb-2 text-center text-xs text-black/55 dark:text-white/60">
            That’s every weekend in the next {applied?.months ?? months} months.
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

      {/* One disclosure for the whole site rather than a line under each widget.
          Every outbound booking link here is affiliate — Kiwi, Booking.com and
          GetYourGuide — so stating it once, where it can't be mistaken for part
          of a card, is both more honest and less noisy. */}
      <footer className="mt-2 flex flex-col gap-2 border-t border-black/10 pt-4 text-xs leading-relaxed text-black/45 dark:border-white/10 dark:text-white/45">
        <p>
          Flights, stays and activities are booked on Kiwi.com, Booking.com and
          GetYourGuide. We may earn a commission from those bookings, at no extra
          cost to you. Prices and availability are set by them, not by us.
        </p>
        {/* Its own row: inline at the end of a four-line paragraph, the one
            navigable thing in the footer was the hardest part of it to find. */}
        <a
          href="/about"
          className="w-fit underline underline-offset-2 transition hover:text-black/70 dark:hover:text-white/70"
        >
          About, privacy &amp; contact
        </a>
      </footer>

      {/* Inert unless ?debug=overflow is in the URL. */}
      <OverflowDebug />
    </main>
  );
}
