"use client";

import {
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
import { monthShort, monthKey } from "@/lib/format";
import { timelineRange } from "@/lib/timeline";
import { priceBuckets } from "@/lib/price";
import { loadHomes, saveHomes, loadRegion, saveRegion } from "@/lib/home-storage";
import { track } from "@/lib/analytics";
import { SegmentedControl } from "@/components/SegmentedControl";
import {
  BRIDGE_HELP,
  SearchReceipt,
  type StopMode,
} from "@/components/SearchReceipt";
import { FacetTrigger } from "@/components/FacetTrigger";
import { OriginSheet } from "@/components/OriginSheet";
import { parseOrigins, serializeOrigins } from "@/lib/origins";
import { MonthFilter } from "@/components/MonthFilter";
import { ContinentFilter } from "@/components/ContinentFilter";
import { PriceFilter } from "@/components/PriceFilter";
import { DealList, SkeletonCard } from "@/components/DealList";
import { DealsMap } from "@/components/DealsMap";
import { CalendarDialog } from "@/components/CalendarDialog";
import { Masthead } from "@/components/Masthead";
import { AboutDialog } from "@/components/AboutDialog";
// Dev-only. The runtime cost was already nil without ?debug=overflow, but the
// component still shipped in every visitor's JS; the constant lets the bundler
// drop it from the production build entirely.
import OverflowDebug from "@/components/OverflowDebug";
const SHOW_OVERFLOW_DEBUG = process.env.NODE_ENV !== "production";

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


// "just now" / "3 min ago" / "2 h ago" — for the price-freshness stamp.
function agoLabel(ts: number): string {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  return `${h} h ago`;
}

export default function Home() {
  // One to three home airports. `home` stays as the primary for the many places
  // that only need one (map centring, "cheapest weekend" lookups).
  const [origins, setOrigins] = useState<string[]>([]);
  const home = origins[0] ?? "";
  // A synchronous mirror of `origins`, for one reader: the origin sheet's close
  // handler. Done resolves the text field and then closes the dialog inside the
  // same click, so the close handler runs with a render closure taken BEFORE
  // that commit — it compared the airport list against its own stale copy, saw
  // no change, and skipped the search. The receipt then named an airport the
  // board had never searched. State stays the source of truth for rendering;
  // this only answers "what is committed right now".
  const originsRef = useRef(origins);
  useEffect(() => {
    originsRef.current = origins;
  }, [origins]);
  function applyOrigins(next: string[]) {
    originsRef.current = next;
    setOrigins(next);
  }
  const [style, setStyle] = useState<WeekendStyle>("strict");
  // The search window is fixed at the widest tier. It was a 1/2/3/6 control
  // until it was measured: 6 months costs +45ms over 3 (same upstream call,
  // wider dates), so choosing anything less only ever returned a thinner
  // board. The month chips below filter what came back, instantly and free.
  const MONTHS_WINDOW = 6;
  const [months] = useState(MONTHS_WINDOW);
  const [stopMode, setStopMode] = useState<StopMode>("direct");
  const [adults, setAdults] = useState(1);
  // Opt-in "bridge days" mode — off by default (a plain search). When on, the
  // API runs the holiday-anchored searches and returns only long-weekend escapes.
  const [bridges, setBridges] = useState(false);
  // Which regional public holidays count as the traveller's own (bridge mode).
  // null = let the server infer from the home airports; "national" = national
  // only, explicitly; an ISO-3166-2 code = that region. Hydrated from
  // localStorage in the bootstrap effect — never in the initializer, because
  // `/` prerenders on the server.
  const [region, setRegion] = useState<string | null>(null);
  // What the server actually used and what it offers — drives the receipt's
  // region control. Comes back on every bridge-mode response.
  const [homeRegionInfo, setHomeRegionInfo] = useState<{
    used: string | null;
    usedName: string | null;
    options: { code: string; name: string }[];
  } | null>(null);
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
  // The calendar view, and the weekend it is filtered to. Opening one panel
  // closes the other: both answer "which of these do I want" and stacking them
  // would push the board off a phone entirely.
  const [showCalendar, setShowCalendar] = useState(false);
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
    region: string | null;
    meetUp: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const loadingMore = false;
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  // First load only: while we detect location + run the initial search, show a
  // quiet spinner instead of the empty form.
  const [booting, setBooting] = useState(true);
  // Which facet's chips are showing. One at a time: two open rows is most of
  // the height the trigger row was introduced to reclaim.
  const [openFacet, setOpenFacet] = useState<"month" | "region" | "price" | null>(
    null
  );

  // Escape closes the open facet and hands focus back to its trigger.
  //
  // SearchReceipt already did this for its own popover; the bar's three facets
  // did not, so the same gesture worked on one disclosure and silently failed
  // on the neighbouring one. Verified before the fix: opening Month and
  // pressing Escape left the panel open.
  //
  // Focus has to come back deliberately. The panel that was open is about to
  // unmount, and if focus sat inside it the browser drops focus on <body> —
  // which sends the next Tab to the top of the document rather than to the
  // next control, and leaves a keyboard user with no idea where they are.
  const facetTriggerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!openFacet) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const trigger = facetTriggerRef.current?.querySelector<HTMLButtonElement>(
        `[aria-controls="refine-${openFacet}"]`
      );
      setOpenFacet(null);
      trigger?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openFacet]);
  // The origin sheet, and the airports it held when it opened — dismissal is
  // the commit, so it needs a before-image to compare against.
  const [sheetOpen, setSheetOpen] = useState(false);
  // Meet-up: with ≥2 home airports, show only destinations everyone can
  // reach on the same weekend, one fare per person, priced as the total.
  // Lives with the origins (the sheet) because it is a statement about them.
  const [meetUp, setMeetUp] = useState(false);
  // Why the sheet is asking: set when geolocation failed, shown inside the
  // sheet, cleared on close or on a later successful detection. Without it a
  // declined permission prompt was answered by an unexplained modal.
  const [geoNotice, setGeoNotice] = useState<string | null>(null);
  // Detection in flight, for the sheet's "Find my airport" button — the tap
  // used to do nothing visible for up to 8 seconds.
  const [detecting, setDetecting] = useState(false);
  const originsAtOpen = useRef<string[] | null>(null);
  // The control bar's real height. The list's month dividers pin directly
  // beneath it, and the bar changes height for several reasons: it wraps to
  // two lines on a phone, it grows when a facet is opened, and the trigger set
  // itself changes with the board.
  //
  // Measured in an effect after every render rather than with a
  // ResizeObserver. Every one of those height changes is caused by a React
  // render, so an effect catches them all — and it removes a dependency that
  // could not be verified in this environment at all (an RO attached to this
  // node did not fire once while its height went 53 -> 91). A resize listener
  // covers the one case with no render behind it.
  const barRef = useRef<HTMLDivElement>(null);
  const [barH, setBarH] = useState(0);
  // How far the bar has to reach on each side to span the viewport. Measured,
  // not `calc((100vw - 100%) / 2)`: 100vw counts the scrollbar, so that made
  // the document 15px wider than the viewport and the page scrollable
  // sideways — a real overflow, clipped by body's overflow-x-hidden and
  // therefore invisible until measured.
  const [bleed, setBleed] = useState(0);
  useEffect(() => {
    const measure = () => {
      const node = barRef.current;
      const h = node?.getBoundingClientRect().height ?? 0;
      // Only ever writes on a real change, so this cannot loop.
      setBarH((prev) => (Math.abs(prev - h) < 0.5 ? prev : h));
      // How far the bar's own left edge sits from the window's. That IS the
      // margin it needs, and it needs no arithmetic about the column: measuring
      // the inner row instead was 24px out, because the bar's natural width is
      // main's CONTENT box while the row carries its own padding.
      const main = node?.closest("main");
      if (main) {
        const cs = getComputedStyle(main);
        const g = Math.max(
          0,
          Math.round(main.getBoundingClientRect().left + parseFloat(cs.paddingLeft))
        );
        setBleed((prev) => (prev === g ? prev : g));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  const bootstrapped = useRef(false);
  // Mirror the current filter values into refs so runSearch (called from effects
  // and callbacks) always reads the latest, without being a dependency.
  const styleRef = useRef(style);
  const monthsRef = useRef(months);
  const stopModeRef = useRef(stopMode);
  const adultsRef = useRef(adults);
  const bridgesRef = useRef(bridges);
  const regionRef = useRef(region);
  const meetUpRef = useRef(meetUp);
  useEffect(() => {
    styleRef.current = style;
    monthsRef.current = months;
    stopModeRef.current = stopMode;
    adultsRef.current = adults;
    bridgesRef.current = bridges;
    regionRef.current = region;
    meetUpRef.current = meetUp;
  });

  // `overrides` exists for callers that set state and search in the SAME
  // handler — the bridge switch does. The refs below are updated in an effect,
  // so at that moment they still hold the PREVIOUS value, and searching from
  // them runs the search the user just turned off. (The receipt's facets are
  // safe without it: they commit on a later event, by which time the effect has
  // run. Passing what the caller already knows costs nothing and removes the
  // ordering question entirely.) Verified by reverting: the bridge regression
  // test fails when `overrides.bridges` is dropped.
  async function runSearch(
    codes: string | string[],
    overrides?: Partial<{
      style: WeekendStyle;
      direct: boolean;
      adults: number;
      bridges: boolean;
      region: string | null;
      meetUp: boolean;
    }>
  ) {
    const list = parseOrigins(
      Array.isArray(codes) ? codes.join(",") : codes
    );
    if (list.length === 0) return;
    // Meet-up needs company: with one airport it silently degrades to a
    // normal search rather than an empty board.
    const meetUpWanted =
      (overrides?.meetUp ?? meetUpRef.current) && list.length > 1;
    const params = {
      style: overrides?.style ?? styleRef.current,
      months: monthsRef.current,
      direct: overrides?.direct ?? stopModeRef.current === "direct",
      adults: overrides?.adults ?? adultsRef.current,
      // Meet-up displaces bridge mode (per-country holiday windows don't
      // combine across origins) — mirrored server-side in the route.
      bridges: meetUpWanted ? false : (overrides?.bridges ?? bridgesRef.current),
      meetUp: meetUpWanted,
      // `undefined` means the caller didn't touch it; null is a real value
      // ("back to automatic"), so ?? would erase it.
      region:
        overrides && "region" in overrides
          ? (overrides.region ?? null)
          : regionRef.current,
    };
    setOrigins(list);
    saveHomes(list);
    setLoading(true);
    setError(null);
    setSearched(true);
    setBooting(false);
    try {
      const qs = new URLSearchParams({
        flyFrom: serializeOrigins(list),
        style: params.style,
        months: String(params.months),
        adults: String(params.adults),
      });
      if (params.direct) qs.set("direct", "1");
      if (params.bridges) qs.set("bridges", "1");
      if (params.bridges && params.region) qs.set("region", params.region);
      if (params.meetUp) qs.set("meetup", "1");
      const res = await fetchWithTimeout(`/api/weekends?${qs.toString()}`, 20000);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Search failed");
      setRawDeals(body.deals ?? []);
      setFetchedAt(body.fetchedAt ?? Date.now());
      setOriginPoints(body.origins ?? []);
      setHomeRegionInfo(body.homeRegion ?? null);
      setApplied({ origins: list, ...params });
      // Activation: one event per answered search, in product vocabulary
      // only (codes and counts — nothing typed by the person).
      track("search", {
        origins: list.join(","),
        origin_count: list.length,
        style: params.style,
        bridges: params.bridges,
        direct: params.direct,
        adults: params.adults,
        results: (body.deals ?? []).length,
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

  function detectLocation(opts?: { fromSheet?: boolean }) {
    const fromSheet = opts?.fromSheet ?? false;
    // First outcome wins. getCurrentPosition's own `timeout` clock does not
    // run while the permission prompt is undecided, and a prompt that is
    // dismissed rather than answered can fire NEITHER callback — which left
    // the boot spinner (no controls) up forever. The guard timer below is the
    // path out of that trap, and `settled` keeps a late real answer from
    // firing a second search over whatever the user did meanwhile.
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(guard);
      setDetecting(false);
      fn();
    };
    const fail = (msg: string) => settle(() => {
      if (fromSheet) {
        // The sheet is open and the user is watching the button they just
        // pressed: the notice is the whole response. Closing or reloading
        // anything here would be the sheet acting on a location it never got.
        setGeoNotice(msg);
        return;
      }
      const saved = loadHomes();
      if (saved.length) {
        // A remembered board still loads; the geolocation miss is invisible
        // and a notice about it would outlive its moment. Say nothing.
        runSearch(saved);
        return;
      }
      // No location and nothing saved. The origin lives in a sheet, so open
      // it — and SAY WHY it opened, because to the visitor the permission
      // prompt just vanished and an unexplained modal reads as a glitch.
      setGeoNotice(msg);
      setBooting(false);
      openOriginSheet();
    });
    const MSG_BLOCKED =
      "Location is blocked for this site — type your airport instead.";
    const MSG_UNFOUND =
      "Couldn't find your location — type your airport instead.";
    if (!navigator.geolocation) {
      fail(MSG_UNFOUND);
      return;
    }
    setDetecting(true);
    const guard = setTimeout(() => fail(MSG_UNFOUND), 12000);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetchWithTimeout(
            `/api/airports?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
            8000
          );
          const body = res.ok ? await res.json() : null;
          const code = body?.airports?.[0]?.code;
          if (code)
            settle(() => {
              setGeoNotice(null);
              if (fromSheet) {
                setSheetOpen(false);
                originsAtOpen.current = null;
              }
              runSearch(code);
            });
          else fail(MSG_UNFOUND);
        } catch {
          fail(MSG_UNFOUND);
        }
      },
      // code 1 is PERMISSION_DENIED — the one failure the visitor themselves
      // chose, so the message can honestly point at the setting. Everything
      // else (unavailable, timeout) is just "couldn't".
      (err) => fail(err?.code === 1 ? MSG_BLOCKED : MSG_UNFOUND),
      { timeout: 8000 }
    );
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
      const meetUp0 = p.get("meetup") === "1";
      // The shared URL's region wins over the stored choice — the link should
      // reproduce the board it described.
      const regionParam = p.get("region");
      const region0 =
        regionParam && /^(national|[A-Z]{2}-[A-Z0-9]{1,3})$/.test(regionParam)
          ? regionParam
          : loadRegion();
      // Seed refs synchronously so the immediate search uses the URL values
      // (state setters haven't flushed yet). Only guard the param-change effect
      // if a non-default value actually changed.
      styleRef.current = style0;
      monthsRef.current = months0;
      stopModeRef.current = stop0;
      adultsRef.current = adults0;
      bridgesRef.current = bridges0;
      regionRef.current = region0;
      meetUpRef.current = meetUp0;
      // Deliberately an effect. `/` is prerendered as static content, so this
      // component renders on the server at build time — reading
      // window.location from a render-phase state initialiser would throw
      // there. Seeding from the URL can only happen after mount. Runs once,
      // guarded by `bootstrapped`.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStyle(style0);
      setStopMode(stop0);
      setAdults(adults0);
      setBridges(bridges0);
      setRegion(region0);
      setMeetUp(meetUp0);
      runSearch(from);
    } else {
      // No URL to honour — the stored explicit region (if any) still applies.
      const stored = loadRegion();
      regionRef.current = stored;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRegion(stored);
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
    if (applied.bridges && applied.region) p.set("region", applied.region);
    if (applied.meetUp) p.set("meetup", "1");
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
  // Trips with under a day at the destination are not trips — more travel than
  // time there — so they are simply not shown. This was a default with a
  // checkbox to override it ("Hide N trips with under a day…"); the checkbox
  // was the only control on the page phrased as a sentence, it moved the
  // layout when it appeared, and in practice unchecking it surfaced flights
  // nobody should book. A rule you would never turn off is not a setting.
  //
  // Memoised: these arrays are dependencies of the map's marker/framing
  // effects, so a new identity on every render made opening Refine (or
  // crossing the scroll threshold) re-frame the map.
  // Weekend selection no longer filters `visible` — Dates is a dialog now,
  // and its selection lives inside it (see CalendarDialog).
  const visible = useMemo(
    () => filtered.filter((d) => !isShortStay(d)),
    [filtered]
  );
  const calendarDeals = visible;
  // The searched date range, for the calendar's month span. `applied.months` is
  // what the current results were fetched with (the live control is pinned at
  // six, but reading `applied` keeps this honest if that ever changes). Anchored
  // to today, exactly as the search was.
  const calendarWindow = useMemo(() => {
    const m = applied?.months ?? months;
    const { dateFrom, dateTo } = timelineRange(m, new Date());
    return { from: dateFrom, to: dateTo };
  }, [applied, months]);
  // The denominator for "N of M": the board before month/region/price, but
  // after the short-stay rule — otherwise a filtered count could exceed a
  // total the user was never shown.
  const total = useMemo(
    () => rawDeals.filter((d) => !isShortStay(d)).length,
    [rawDeals]
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
      //
      // behavior "auto", never "smooth". Verified in the running app: every
      // smooth scroll on this page dies within ~8px — window.scrollTo({top:
      // 2000, behavior:"smooth"}) landed at 8 while the instant form landed
      // exactly — so a smooth jump reads as "nothing happened". Instant is
      // also what reduced-motion users always got, and what Google's own
      // grid-to-result jumps do.
      requestAnimationFrame(() => {
        // "start", not "center". Centring a card taller than the viewport — any
        // expanded one — puts its top ABOVE the top of the screen, so clicking a
        // price on the map landed you in the middle of a card whose city and
        // fare were scrolled off: the answer to "which one is this?" was the one
        // part you could not see. Aligning to the top and letting the card's own
        // scroll-margin clear the pinned bar (it reads the same measured height
        // the bar publishes) puts the title exactly under the bar every time.
        document.getElementById(id)?.scrollIntoView({
          block: "start",
          behavior: "auto",
        });
      });
    },
    [visible]
  );

  // The base universe for every facet count: what the user can actually see,
  // respecting the short-stay toggle.
  const countable = useMemo(
    () => rawDeals.filter((d) => !isShortStay(d)),
    [rawDeals]
  );

  // FACET COUNTS EXCLUDE THEIR OWN FACET AND HONOUR EVERY OTHER ONE.
  //
  // These used to be computed over `countable` flat, ignoring all three
  // selections, and the comment claimed each pill showed "how many trips it
  // would surface". That is only true on an unfiltered board. Observed on the
  // live app: with Sep selected the Region row still read "Europe 13 · Africa
  // 1 · Asia 1" — the whole 15-deal board — while the list showed 2. Tapping
  // "Asia 1" produced "0 of 15 flights". The count promised a result the month
  // filter had already excluded, and the UI walked the user into a dead end.
  //
  // The rule that fixes it is the standard one for faceted search: a facet's
  // counts are computed over the set filtered by all the OTHER facets, never
  // by itself. Excluding its own facet is what makes the number mean "how many
  // MORE this adds" for an OR-multi-select — with Sep on, Asia genuinely adds
  // nothing, so it reads 0 and is disabled rather than clickable.
  //
  // Own-facet exclusion also keeps a selected pill honest: if Region counted
  // itself, selecting Europe would drop every other region to 0 and you could
  // never widen the selection.
  // Both maps are SEEDED with every option at zero before counting. A missing
  // key is `undefined`, which renders as no number at all and reads as "not
  // counted" rather than "none" — so the option stayed enabled and stayed a
  // dead end, which is the whole bug this is here to fix.
  const monthCounts = useMemo(() => {
    const base = filterByMaxPrice(
      filterByContinents(countable, selectedContinents),
      cap
    );
    const m: Record<string, number> = {};
    for (const k of available) m[k] = 0;
    for (const d of base) {
      const k = monthKey(d.outDepart);
      if (k in m) m[k] += 1;
    }
    return m;
  }, [countable, available, selectedContinents, cap]);

  const continentCounts = useMemo(() => {
    const base = filterByMaxPrice(
      filterByMonths(countable, selectedMonths),
      cap
    );
    const m: Record<string, number> = {};
    for (const c of availableContinents) m[c] = 0;
    for (const d of base) {
      const c = continentOf(d.countryToCode);
      if (c in m) m[c] += 1;
    }
    return m;
  }, [countable, availableContinents, selectedMonths, cap]);
  // "CLJ" is an aviation dialect; the receipt should say "Cluj-Napoca". Every
  // deal already names its departure city (cityFrom, resolved server-side), so
  // the map costs one pass over data the client holds anyway — no airport
  // lookup table crosses the wire, which client-bundle.test.ts would forbid.
  const originCities = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of rawDeals) {
      if (d.flyFrom && d.cityFrom) m[d.flyFrom] = d.cityFrom;
    }
    return m;
  }, [rawDeals]);
  const currency = rawDeals[0]?.currency ?? "EUR";

  function clearAll() {
    setSelectedMonths([]);
    setSelectedContinents([]);
    setMaxPrice(bounds.max);
  }

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

  // Same rule, applied to price: the bands come from the prices still reachable
  // under the current month/region choice, excluding price itself. Derived this
  // way a band can never be empty — it is cut from the very set it filters — so
  // this needs no disabled state, unlike Month and Region.
  const priceBucketList = useMemo(
    () =>
      priceBuckets(
        filterByContinents(
          filterByMonths(countable, selectedMonths),
          selectedContinents
        ).map((d) => d.price)
      ),
    [countable, selectedMonths, selectedContinents]
  );

  const hasRefinements =
    available.length > 0 ||
    availableContinents.length > 1 ||
    priceBucketList.length > 0;

  const activeFilters =
    selectedMonths.length +
    selectedContinents.length +
    (cap < bounds.max ? 1 : 0);
  // Commit-on-dismiss for the receipt facets. `patch` carries the value the
  // popover was closed on, because state set moments ago has not reached the
  // refs runSearch would otherwise read.
  function commitReceipt(patch: {
    style?: WeekendStyle;
    stopMode?: StopMode;
    adults?: number;
    bridges?: boolean;
    region?: string | null;
  }) {
    if (!home.trim()) return;
    runSearch(origins, {
      style: patch.style,
      direct: patch.stopMode ? patch.stopMode === "direct" : undefined,
      adults: patch.adults,
      bridges: patch.bridges,
      ...("region" in patch ? { region: patch.region } : {}),
    });
  }



  // The sheet edits `origins` live (chips appear as you add them), so the
  // before-image has to be taken when it opens.
  const meetUpAtOpen = useRef<boolean | null>(null);

  function openOriginSheet() {
    originsAtOpen.current = origins;
    meetUpAtOpen.current = meetUp;
    setSheetOpen(true);
  }

  function closeOriginSheet() {
    setSheetOpen(false);
    // The notice explains why the sheet opened; once the visitor leaves it,
    // it has been read (or overtaken by a typed airport) either way.
    setGeoNotice(null);
    const before = originsAtOpen.current;
    const meetBefore = meetUpAtOpen.current;
    originsAtOpen.current = null;
    meetUpAtOpen.current = null;
    if (!before) return;
    // The ref, not the state: see the note where it is declared. Reading
    // `origins` here missed anything the field committed on the way out.
    const after = originsRef.current;
    const meetChanged = meetBefore !== null && meetBefore !== meetUpRef.current;
    if (
      [...before].sort().join() === [...after].sort().join() &&
      !meetChanged
    )
      return;
    if (after.length === 0) {
      // Emptied and dismissed: put back what was searched rather than leaving
      // the board showing results for an airport the receipt no longer names.
      applyOrigins(before);
      return;
    }
    runSearch(after);
  }

  // Widen the search window a tier and fold the wider results into the list in
  // place — no skeleton takeover, no scroll jump — so it reads as "load more".


  return (
    <main
      className="max-w-4xl mx-auto w-full min-w-0 p-4 sm:p-6 flex flex-col gap-4"
      // The list's month dividers are sticky at the top as well. This is what
      // keeps the two from stacking on the same line: they pin below the bar
      // while it exists, and at the viewport top when it doesn't.
      style={
        {
          "--list-sticky-top": `${Math.round(barH)}px`,
        } as React.CSSProperties
      }
    >
      {/* CENTRED, on the evidence of the two references this was measured
          against. weekendflights.app centres a two-line hero over its search
          bar; Google Flights Deals centres an eyebrow, then the product name,
          then "from <city>", then the search. Both put the masthead on the
          page's axis and let the content below it start the grid. Left-aligned,
          this stack read as four things stacked in a corner.

          The order is the reference order: eyebrow, name, promise. The rotating
          descriptor moves ABOVE the wordmark and becomes that eyebrow — it kept
          its meaning and lost the fight it was picking with a 46px wordmark for
          the right-hand baseline. */}
      {/* pb-3 on top of the column's gap-4: the masthead is display type and
          the receipt is a control row — ~28px between them lets them read as
          two things instead of one block. */}
      <Masthead />



      {booting ? (
        /* First load: a spinner and the one line that earns its place, then the
           same skeletons as a search for one consistent loading state.

           The value-prop paragraph that used to open this block is gone — the
           masthead above already makes the promise, so the explainer was
           restating the screen it sat on, at the exact moment a permission
           dialog was competing for attention. What stays is the geolocation
           line, because the browser's location prompt appears with no context
           of its own, and an unexplained permission ask reads as a reason to
           decline.

           The spinner is inline SVG on currentColor, muted. Under
           prefers-reduced-motion it stops spinning and the text alone carries
           the state — a frozen ring next to a sentence still reads as
           "working", while a spinning one violates the setting. */
        <div className="flex flex-col gap-3">
          <div
            className="flex items-center justify-center gap-2.5 py-2 text-sm text-muted-foreground"
            role="status"
          >
            <svg
              className="h-4 w-4 shrink-0 motion-safe:animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 3a9 9 0 1 1-6.36 2.64" />
            </svg>
            <span>
              Finding your nearest airport — used only for this. Decline and
              type it in.
            </span>
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
      <div className="flex flex-col gap-4 animate-fade-in">
      {/* The whole search, as one line of prose. It replaces a panel of six
          labelled controls, a commit bar and the dirty state that drove it.
          The rule it establishes and the filters below obey: THE RECEIPT
          RELOADS, THE FILTERS ARE FREE. Every facet here costs an upstream
          call — marked by the dotted underline and the ↻ — and everything in
          Refine is an Array.filter over deals already in memory. Months live
          down there, with the free things, because that is what they now are:
          the window is pinned at six, so choosing a month never re-searches. */}
      <SearchReceipt
        origins={origins}
        originCities={originCities}
        values={{ style, stopMode, adults, bridges, region }}
        homeRegion={applied?.bridges ? homeRegionInfo : null}
        meetUp={applied?.meetUp ?? false}
        onChange={(patch) => {
          if (patch.style !== undefined) setStyle(patch.style);
          if (patch.stopMode !== undefined) setStopMode(patch.stopMode);
          if (patch.adults !== undefined) setAdults(patch.adults);
          if (patch.bridges !== undefined) setBridges(patch.bridges);
          if (patch.region !== undefined) {
            setRegion(patch.region);
            // Only the explicit choice persists; "back to automatic" (null)
            // clears the stored value rather than storing it.
            saveRegion(patch.region);
          }
        }}
        onCommit={commitReceipt}
        onEditOrigins={openOriginSheet}
      />

      {/* Results header and filter controls, one block under one hairline.
          They used to be two: the count/Sort/Map row, then the facet triggers
          on a line of their own. That left 414px of dead space to the right of
          "Price 4" and a half-empty row above it — two ragged lines where the
          content fits comfortably on one. Measured: triggers 306px + Sort/Map
          267px = 573px, which fit even the old 720px box and now sit inside
          848px with room to spare. */}
      {searched && (
        /* A Fragment, not a wrapper div. `position: sticky` pins only within
           its own PARENT's box, so while the bar sat inside a short wrapper it
           scrolled away the moment that wrapper did — pinned for about 40px,
           which looks exactly like not working. As a direct child of <main>,
           which spans the whole page, it pins for the whole page. */
        <>
          {/* Only the freshness stamp is left up here. The count moved into
              the bar below, because the bar is pinned and a count you cannot
              see while scrolling a filtered board is a count that is not
              doing its job. */}
          {/* THE CONTROL BAR, and the only persistent chrome on the page.
              What you are looking at and everything that changes it, on one
              pinned line: the count and the filters on the left, the ordering
              and the map on the right.

              It replaced two workarounds. A conditional bar used to appear on
              a filtered board once the filters scrolled away, printing the
              count and the active filters as removable chips — but the
              triggers show their own state now ("✓ Europe"), so that was the
              same facts twice. And a floating "↑ Sort & filter" pill existed
              purely to scroll you back to controls you could not reach; there
              is nothing to scroll back to when the controls never leave.

              The cost is honest and permanent: this is chrome on an
              unfiltered board too, where the old conditional bar was free. It
              buys one-tap filtering and re-sorting at any depth on a board
              that runs to ~3,700px, and it reclaims most of its own height
              from the two things it deletes.

              Full-bleed via negative margins so the blur spans the gutter
              rather than stopping at the text column. */}
          <div
            id="refine-panel"
            ref={barRef}
            // Full-bleed. At 1280 the column is 896px, so a bar that stopped
            // at its edge read as a floating strip with a hard vertical cut
            // and the page showing past it.
            //
            // Properly frosted rather than nearly-opaque: bg-background/90 over
            // a 4px blur let card text read straight through, which is most of
            // what made it look unfinished. /70 over a 24px blur is glass.
            style={{ marginInline: `-${bleed}px` }}
            className="sticky top-0 z-30 border-b border-black/[0.07] bg-background/70 backdrop-blur-xl dark:border-white/10"
          >
            {/* The bar bleeds; its CONTENTS stay on the column. */}
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-2 px-4 py-2 sm:px-6">
              {/* `sm:flex-nowrap` is load-bearing. This row's width is not
                  fixed: the count runs from "14 flights" (66px) to "23 long
                  weekends" (125px), and "Clear all" appears with a filter.
                  Measured, a bridge-mode board needed 770px, which overflowed
                  the old 768px box and broke the Sort/Map cluster onto a
                  second line — over by two pixels, and by ~57 once a filter
                  was on. Trimming pixels could not hold that. The column is
                  896px now and that particular overflow is gone, but the rule
                  stays: the row's width is content-driven, so it must not be
                  left to wrap.

                  So above `sm` the row never wraps and the trigger group, the
                  only shrinkable child, scrolls instead. Below `sm` it still
                  wraps, because at 342px one line would crush the triggers to
                  nothing. */}
              {/* On a phone this is TWO ROWS, and which control sits on which
                  is assigned rather than left to flexbox. It used to be one
                  `flex-wrap` row, and the result was not a wrap at all: given a
                  shrinkable child, flexbox shrinks before it wraps, so the
                  trigger group collapsed to a 37px sliver at 390px and 8px at
                  360px — 313px and 342px of filters scrolled out of sight. The
                  filters were, in effect, not on the page.

                  Row 1 is the count and the ordering; row 2 is the filters,
                  full width and `shrink-0` so they can never be crushed again.
                  `order-*` assigns that arrangement on a phone and returns them
                  inline from `sm` up, where all three genuinely fit one line. */}
              {/* Plain wrapping flex. This was a 2-column grid left over from
                  when the count lived in the bar; the count has since moved
                  out, but the grid stayed — so the trigger row was nested in a
                  `minmax(0,1fr)` column that the sort cluster squeezed to about
                  100px, giving 33px tracks and overlapping labels at 320. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:flex-nowrap">
                {/* Count and Clear all share the top-left cell so the count can
                    wrap INSIDE it rather than shoving the sort control onto a
                    row of its own. */}

            {searched && hasRefinements && (
              /* Insurance, not the normal case: the widest state — all three
                 set, each multi-select — measured 325px in a 350px column. */
              /* col-end-3, NOT col-span-2: in Tailwind v4 col-span-* emits the
                 grid-column shorthand and would clobber col-start-1. */
              /* -my-1/py-1, NOT -mx-1/px-1. The horizontal version kept focus
                 rings clear of the scroller's overflow, but it also pulled the
                 whole group 4px left of the count above it — measured 450
                 against 454 — which is the ragged left edge on a phone. Focus
                 rings only ever needed vertical room. */
              /* A 3-COLUMN GRID below `sm`, not a flex scroller. Each trigger
                 gets exactly a third of the row, so they cannot overlap, cannot
                 shrink each other, and there is nothing to scroll — measured
                 before this, the group had 109px of box holding 246px of
                 triggers at 390px, so "Price" was off the edge and only
                 reachable by swiping a row most people would not guess was
                 swipeable.

                 Flex kept failing here for the same reason each time: a
                 shrinkable child absorbs the overflow instead of the line
                 wrapping. A grid track cannot do that — the width is declared,
                 not negotiated. From `sm` up it is an inline flex row again,
                 where all three fit with room to spare. */
              <div
                ref={facetTriggerRef}
                className="grid w-full basis-full grid-cols-3 gap-1 max-sm:order-3 sm:flex sm:w-auto sm:basis-auto sm:gap-1.5 sm:overflow-x-auto"
              >
                {priceBucketList.length > 0 && (
                  <FacetTrigger
                    label="Price"
                    placeholder="Price"
                    controls="refine-price"
                    value={cap < bounds.max ? `≤ ${cap}` : null}
                    open={openFacet === "price"}
                    onClick={() =>
                      setOpenFacet((f) => (f === "price" ? null : "price"))
                    }
                  />
                )}
                {available.length > 0 && (
                  <FacetTrigger
                    label="Month"
                    placeholder="Month"
                    controls="refine-month"
                    value={
                      selectedMonths.length === 1
                        ? monthShort(selectedMonths[0])
                        : selectedMonths.length > 1
                          ? `${monthShort(selectedMonths[0])} +${selectedMonths.length - 1}`
                          : null
                    }
                    open={openFacet === "month"}
                    onClick={() =>
                      setOpenFacet((f) => (f === "month" ? null : "month"))
                    }
                  />
                )}
                {availableContinents.length > 1 && (
                  <FacetTrigger
                    label="Region"
                    placeholder="Region"
                    controls="refine-region"
                    value={
                      selectedContinents.length === 1
                        ? selectedContinents[0]
                        : selectedContinents.length > 1
                          ? `${selectedContinents[0]} +${selectedContinents.length - 1}`
                          : null
                    }
                    open={openFacet === "region"}
                    onClick={() =>
                      setOpenFacet((f) => (f === "region" ? null : "region"))
                    }
                  />
                )}
              </div>
            )}

            {/* ml-auto rather than justify-between: with no filters on the
                board the left side is empty, and justify-between would park
                these hard left. */}
            {/* The word "Sort" used to label this. It cost 25px + its gap, and
                the row needed 748 of a 768px box — so it was the difference
                between one line and two. A two-segment Soonest/Cheapest control
                does not need telling you it sorts. */}
            {/* Map rides with Sort rather than on a band of its own. As its
                own row it was one right-aligned button with an empty half-row
                beside it — the gap you see above the count on a phone. It fits
                here only because the triggers dropped their "Any " prefixes:
                350px of labels became 235, and Map is 72. */}
            {/* w-full below `sm`, so on a phone this cluster owns its row and
                the sort control inside it can stretch to fill it.

                max-sm:order-2 lifts this row ABOVE the filter triggers on a
                phone. The open facet's chips render after the whole controls
                block, so with sort at the bottom the chips appeared under
                Soonest/Cheapest — a Region panel visually attached to the
                sort control instead of to the Region button that opened it.
                Sort above, triggers below (max-sm:order-3), chips directly
                beneath the triggers. DOM order is unchanged. */}
            <div className="flex w-full shrink-0 items-center gap-1.5 max-sm:order-2 sm:ml-auto sm:w-auto">
              {/* Hidden while a search is in flight, like Calendar and Map
                  beside it — they always were, and the sort control was the one
                  member of the cluster offering to order skeletons. One gate
                  for the whole row: controls appear when there is something to
                  control. */}
              {!loading && !error && visible.length > 0 && (
                <SegmentedControl
                  options={[
                    { value: "soonest" as SortKey, label: "Soonest" },
                    { value: "cheapest" as SortKey, label: "Cheapest" },
                  ]}
                  value={sort}
                  onChange={setSort}
                  ariaLabel="Sort"
                />
              )}
              {!loading && !error && calendarDeals.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowCalendar(true)}
                  // A dialog now, not a disclosure: haspopup replaces the
                  // expanded/controls pair, and the chevron — which promised
                  // an inline reveal — goes with them.
                  aria-haspopup="dialog"
                  className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-black/15 px-3 text-sm text-black/70 transition duration-200 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-black/5 sm:h-9 sm:px-3.5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Calendar
                </button>
              )}
              {!loading && !error && visible.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMap((v) => !v);
                    setShowCalendar(false);
                  }}
                  aria-expanded={showMap}
                  aria-controls="results-map"
                  className="relative inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border border-black/15 px-3 text-sm text-black/70 transition duration-200 before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] hover:bg-black/5 sm:h-9 sm:px-3.5 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/10"
                >
                  Map
                  <span aria-hidden>{showMap ? "▴" : "▾"}</span>
                </button>
              )}
            </div>

              </div>

              {/* Inside the sticky container so the chips pin with the bar —
                  opening a facet 2,000px down drops its values over the board
                  rather than somewhere off screen. But a SIBLING of the
                  controls row, not a flex item in it: as a `basis-full` child
                  of a `sm:flex-nowrap` row it was forced onto the same line,
                  which crushed the trigger group to 71px and hid 277px. */}
              {hasRefinements && openFacet === "month" && (
              <div id="refine-month" className="animate-fade-in">
                <MonthFilter
                  months={available}
                  selected={selectedMonths}
                  counts={monthCounts}
                  onToggle={toggleMonth}
                />
              </div>
            )}
              {hasRefinements && openFacet === "region" && (
              <div id="refine-region" className="animate-fade-in">
                <ContinentFilter
                  continents={availableContinents}
                  selected={selectedContinents}
                  counts={continentCounts}
                  onToggle={toggleContinent}
                />
              </div>
            )}
              {hasRefinements && openFacet === "price" && (
              <div id="refine-price" className="animate-fade-in">
                <PriceFilter
                  buckets={priceBucketList}
                  max={bounds.max}
                  value={cap}
                  currency={currency}
                  onChange={setMaxPrice}
                />
              </div>
            )}
            </div>
          </div>

        </>
      )}

          {/* Below the pinned bar and directly above the first card, so it
              scrolls away under the bar on the first flick. It is status, not
              control: a timestamp and a total that answer "did the search
              work" once, at the top, and have no business occupying a row you
              carry with you for 3,000px.

              Inside the bar it took the left third, forced the phone layout
              into a two-line cell, and left 23px of text floating beside a
              48px pill. A filtered board still announces itself once this has
              scrolled off, because every set filter lights its own trigger
              ("✓ Europe") in the bar that IS pinned. */}
          {searched && (
            <div
              // The board replaces itself without moving focus, so for a screen
              // reader nothing happened: "Searching…" → "14 flights" → "4 of 14
              // flights" all landed silently, and a filter that emptied the list
              // was indistinguishable from one that did nothing. This line is
              // already the place that answers "did it work", so it is the right
              // live region. Polite, not assertive — it reports a result the
              // user asked for, it does not interrupt.
              role="status"
              aria-live="polite"
              className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1"
            >
              <span className="text-[15px] font-semibold tracking-tight tabular-nums">
              {loading
                ? "Searching…"
                : error
                  ? "Couldn’t load"
                  : (() => {
                      // Reads `applied`, never live form state: the deals on
                      // screen were fetched with the PREVIOUS settings, and
                      // reading the live values once relabelled 57 weekend
                      // results as "bridge escapes" before any search ran.
                      const isBridges = applied ? applied.bridges : bridges;
                      const noun = isBridges
                        ? `long weekend${visible.length === 1 ? "" : "s"}`
                        : `flight${visible.length === 1 ? "" : "s"}`;
                      return activeFilters > 0
                        ? `${visible.length} of ${total} ${noun}`
                        : `${visible.length} ${noun}`;
                    })()}
              </span>
              {!loading && !error && fetchedAt && visible.length > 0 && (
                <span className="text-[11px] text-muted-foreground">
                  Checked {agoLabel(fetchedAt)}
                </span>
              )}
              {/* Why the board just got shorter. The toggle says what the mode
                  is called; this says what it did. Only while it is on — off,
                  it would be explaining something that is not happening. */}
              {!loading && !error && (applied ? applied.bridges : bridges) && (
                <span className="basis-full text-[11px] text-muted-foreground sm:basis-auto">
                  {BRIDGE_HELP}
                </span>
              )}
              {!loading && !error && activeFilters > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  className="relative text-[11px] text-muted-foreground underline underline-offset-2 before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] hover:text-black dark:hover:text-white"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

      {/* Mounted only while open: a closed <dialog> still keeps its children
          in the DOM, which meant every deal existed twice on the page — once
          on the board, once inside the hidden calendar panel. Screen readers
          walking the document and anything matching by text saw doubles. */}
      {searched && showCalendar && (
        <CalendarDialog
          open={showCalendar}
          deals={calendarDeals}
          currency={currency}
          // The window these deals were actually searched over, so the calendar
          // shows every month the search covered — six for a six-month search —
          // rather than only the months that happened to return a flight.
          window={calendarWindow}
          hideStops={applied?.direct === true}
          onClose={() => setShowCalendar(false)}
        />
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
                  counts={monthCounts}
                  onToggle={toggleMonth}
                />
              ) : undefined
            }
          />
          <p className="text-[11px] text-muted-foreground">
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
          hideStops={applied?.direct === true}
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
          // The same search again, with the settings that produced the error —
          // runSearch reads the live form through refs, so there is nothing to
          // reconstruct here.
          onRetry={() => runSearch(originsRef.current)}
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
      {/* Terminal state at the widest window, so the list has a definite bottom. */}
      {searched && !loading && !error && !loadingMore && visible.length > 0 && (
        <p className="pt-1 pb-2 text-center text-xs text-muted-foreground">
          That’s every weekend in the next {applied?.months ?? months} months.
        </p>
      )}
      </div>
      )}

      {/* One disclosure for the whole site rather than a line under each widget.
          Every outbound booking link here is affiliate — Kiwi, Booking.com and
          GetYourGuide — so stating it once, where it can't be mistaken for part
          of a card, is both more honest and less noisy. */}
      {/* Centred, on the masthead's axis — the wordmark, the promise line and
          the receipt row all sit on it, so a left-aligned block at the very
          bottom was the one thing hanging off the page's centre line. */}
      <footer className="mt-2 flex flex-col items-center gap-2 border-t border-black/10 pt-4 text-center text-xs leading-relaxed text-muted-foreground dark:border-white/10">
        {/* Capped at a readable measure. The board is max-w-4xl, and this
            paragraph took the whole of it: 141 characters a line at desktop
            width, measured — roughly double the 65–75 a reader tracks without
            losing the return sweep. It is the one paragraph on the page anybody
            reads as prose, and the one that most needs to be believed. */}
        <p className="mx-auto max-w-prose">
          Flights, stays and activities are booked on Kiwi.com, Booking.com and
          GetYourGuide. We may earn a commission from those bookings, at no extra
          cost to you. Prices and availability are set by them, not by us.
        </p>
        {/* Its own row: inline at the end of a four-line paragraph, the one
            navigable thing in the footer was the hardest part of it to find.
            Opens in a dialog so reading the small print does not cost you the
            board you were reading — but it is still a real link to a real
            page. */}
        <AboutDialog className="w-fit underline underline-offset-2 transition hover:text-black/70 dark:hover:text-white/70" />
      </footer>

      {/* Inert unless ?debug=overflow is in the URL. */}
      {/* Mounted unconditionally — a modal <dialog> is in the top layer, so
          where it sits in the tree is irrelevant, and keeping it outside the
          booting branch means the geolocation fallback can open it before the
          board exists. */}
      <OriginSheet
        open={sheetOpen}
        origins={origins}
        onChange={applyOrigins}
        // The sheet STAYS OPEN while detection runs. It used to close first,
        // which on a denied permission meant either a silent reload of the old
        // search or the sheet popping straight back with no explanation —
        // detectLocation closes it itself, and only on success.
        onDetect={() => detectLocation({ fromSheet: true })}
        detecting={detecting}
        notice={geoNotice}
        meetUp={meetUp}
        onMeetUpChange={(v) => {
          setMeetUp(v);
          // Bridge mode can't ride along (per-country holiday windows) — the
          // trip-length facet visibly returns to its shape when this flips on.
          if (v) setBridges(false);
        }}
        onClose={closeOriginSheet}
      />

      {SHOW_OVERFLOW_DEBUG && <OverflowDebug />}
    </main>
  );
}
