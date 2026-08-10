"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  LngLatBounds,
  type GeoJSONSource,
  type LngLatBoundsLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Deal } from "@/lib/deals";
import { greatCircle, angularDistance } from "@/lib/great-circle";
import { DealCard } from "@/components/DealCard";

// Real vector map: OpenStreetMap data, Mapbox-quality styling via MapLibre GL.
//
// Tiles come from OpenFreeMap, which needs no API key — deliberate, because a
// Mapbox/MapTiler key would be visible in the client bundle and rate-limitable
// by anyone who read it. Raw OSM raster tiles are not an option either; their
// usage policy forbids app traffic.
//
// This module is only ever reached through next/dynamic(ssr:false) from the
// toggle, so its ~230 KB costs nothing until someone opens the map.
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";
const STYLE_DARK = "https://tiles.openfreemap.org/styles/fiord";

const ROUTES_SOURCE = "deal-routes";
const ROUTES_LAYER = "deal-routes-line";
const DOTS_SOURCE = "deal-dots";
const DOTS_LAYER = "deal-dots-circle";
const DOTS_HIT_LAYER = "deal-dots-hit";
const DOTS_LABEL_LAYER = "deal-dots-label";

// Street-level zoom tells you nothing at board scope and multiplies tile
// fetches; cap it well short.
const MAX_ZOOM = 9;

// Only the cheapest N destinations get a labelled chip. MapLibre's HTML markers
// do not collide-detect, so labelling all ~50 turns the dense European cluster
// into unreadable overlap. The rest render as dots — still visible, still
// counted in the text summary, just not shouting.
const MAX_LABELS = 12;

// A destination this much further from home than the typical one shouldn't be
// allowed to set the camera: one Brazil pin among forty European ones zooms the
// map out until Europe is a smudge. Outliers stay rendered — "Fit all" reaches
// them — they just don't own the viewport.
const OUTLIER_DISTANCE_FACTOR = 2.5;
const MIN_FRAMED_PINS = 5;

export interface OriginPoint {
  code: string;
  coords: [number, number] | null;
}

interface Pin {
  key: string;
  city: string;
  price: number;
  currency: string;
  lat: number;
  lon: number;
  extra: number; // other weekends to the same airport
  // Which home airport the cheapest deal to here departs from — the arc has to
  // start where the flight actually starts, not at the primary origin.
  fromCode: string;
}

function pinsFrom(deals: Deal[]): Pin[] {
  const byAirport = new Map<string, Pin>();
  for (const d of deals) {
    if (!d.toCoords) continue;
    const prev = byAirport.get(d.flyTo);
    if (prev) {
      prev.extra += 1;
      if (d.price < prev.price) {
        prev.price = d.price;
        prev.city = d.cityTo;
        prev.fromCode = d.flyFrom;
      }
      continue;
    }
    byAirport.set(d.flyTo, {
      key: d.flyTo,
      city: d.cityTo,
      price: d.price,
      currency: d.currency,
      lat: d.toCoords[0],
      lon: d.toCoords[1],
      extra: 0,
      fromCode: d.flyFrom,
    });
  }
  return [...byAirport.values()].sort((a, b) => a.price - b.price);
}

// The pins the camera should frame: everything within a sane multiple of the
// median distance from home. Returns all of them when the spread is tight or
// the sample is too small for a median to mean anything.
export function framedPins(pins: Pin[], origin: [number, number] | null): Pin[] {
  if (!origin || pins.length < MIN_FRAMED_PINS) return pins;
  const from: [number, number] = [origin[1], origin[0]];
  const withDist = pins.map((p) => ({
    p,
    d: angularDistance(from, [p.lon, p.lat]),
  }));
  const sorted = [...withDist].sort((a, b) => a.d - b.d);
  const median = sorted[Math.floor(sorted.length / 2)].d;
  if (median <= 0) return pins;
  const kept = withDist
    .filter((x) => x.d <= median * OUTLIER_DISTANCE_FACTOR)
    .map((x) => x.p);
  return kept.length >= MIN_FRAMED_PINS ? kept : pins;
}

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );
}

function boundsOf(points: [number, number][]): LngLatBoundsLike {
  return points.reduce(
    (b, p) => b.extend(p),
    new LngLatBounds(points[0], points[0])
  ) as unknown as LngLatBoundsLike;
}

// Paint expressions for the arc layer. Split out so the hover effect and the
// initial layer definition cannot drift apart.
function arcPaint(highlight: string | null) {
  const isHit: unknown[] = ["==", ["get", "to"], highlight ?? "\u0000"];
  return {
    width: highlight ? (["case", isHit, 2.4, 0.6] as unknown) : 1,
    // The un-hovered arcs drop rather than the hovered one merely rising: at
    // ~50 overlapping lines, brightening one is invisible unless the fan
    // recedes behind it.
    opacity: highlight ? (["case", isHit, 0.95, 0.08] as unknown) : 0.25,
  };
}

export default function DealsMapGL({
  deals,
  origins,
  onSelect,
  getView,
  onViewChange,
  fullscreen = false,
  onToggleFullscreen,
  highlight = null,
  controls,
}: {
  deals: Deal[];
  // One to three home airports. Each deal names its own, so arcs and the
  // framing anchor on the right one rather than all on the first.
  origins: OriginPoint[];
  onSelect?: (flyTo: string) => void;
  // Camera handed in and reported back, so remounting into the dialog (and out
  // again) resumes exactly where the user left off. A getter, not a value: the
  // parent holds it in a ref, and refs must not be read during render.
  getView?: () => { center: [number, number]; zoom: number } | null;
  onViewChange?: (v: { center: [number, number]; zoom: number }) => void;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // `flyTo` of the deal the cursor is over in the list, or null. Drives the
  // arc highlight; the map never sets it.
  highlight?: string | null;
  // Filter UI to float over the map in fullscreen. Passed in as a node rather
  // than as month/region props: the map has no business knowing what a filter
  // is, and the caller already owns that state.
  controls?: React.ReactNode;
}) {
  const wrapper = useRef<HTMLDivElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  const markers = useRef<Marker[]>([]);
  // Once the user has panned or zoomed, the camera is theirs. Re-fitting on the
  // next filter change would yank the view out from under them.
  const userMoved = useRef(false);
  // True when this map resumed a camera from a previous mount, so auto-fit must
  // not overwrite the view the user left.
  const resumedView = useRef(false);
  const [failed, setFailed] = useState(false);
  // Markers cannot be added until the style has loaded: Marker.addTo immediately
  // projects its position, and the projection doesn't exist until then. Adding
  // early throws inside MapLibre, which aborts the whole effect — taking
  // fitBounds and, with it, all tile loading down with it.
  const [ready, setReady] = useState(false);
  // Destination the pointer is over ON THE MAP. Separate from the `highlight`
  // prop (which the list drives) because both must work: the list outside
  // fullscreen, the pins inside it.
  const [mapHover, setMapHover] = useState<string | null>(null);
  // Fullscreen only: the deal a pin click opened. Outside fullscreen the click
  // still scrolls the list, which is visible and is the better answer.
  const [picked, setPicked] = useState<string | null>(null);
  const pickedDeal = useMemo(
    () => (picked ? (deals.find((d) => d.flyTo === picked) ?? null) : null),
    [picked, deals]
  );
  // The dot-layer click handler is bound once on the map; route it through a ref
  // so it always calls the current onSelect. Written in an effect, not during
  // render — a ref write during render is unsafe under concurrent rendering.
  const onSelectRef = useRef(onSelect);
  const fullscreenRef = useRef(fullscreen);
  const onViewChangeRef = useRef(onViewChange);
  useEffect(() => {
    onSelectRef.current = onSelect;
    fullscreenRef.current = fullscreen;
    onViewChangeRef.current = onViewChange;
  }, [onSelect, onViewChange, fullscreen]);

  const pins = useMemo(() => pinsFrom(deals), [deals]);
  // Lookup for arcs: a deal's own departure airport.
  const originByCode = useMemo(() => {
    const m = new Map<string, [number, number]>();
    for (const o of origins) if (o.coords) m.set(o.code, o.coords);
    return m;
  }, [origins]);
  const primary = origins[0]?.coords ?? null;
  const framed = useMemo(() => framedPins(pins, primary), [pins, primary]);
  const hiddenByFraming = pins.length - framed.length;

  const fitTo = useCallback(
    (subset: Pin[], animate: boolean) => {
      const m = map.current;
      if (!m) return;
      const pts: [number, number][] = subset.map((p) => [p.lon, p.lat]);
      // Every home airport must stay in frame, not just the first.
      for (const o of origins) if (o.coords) pts.push([o.coords[1], o.coords[0]]);
      if (pts.length === 0) return;
      if (pts.length === 1) {
        m.jumpTo({ center: pts[0], zoom: 5 });
        return;
      }
      m.fitBounds(boundsOf(pts), {
        padding: 40,
        maxZoom: 6,
        animate:
          animate &&
          !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
      });
    },
    [origins]
  );

  // Create the map once. Re-creating it on every filter change would refetch
  // tiles and flash the canvas.
  useEffect(() => {
    if (!holder.current || map.current) return;
    // Read inside the effect, never during render.
    const resumed = getView?.() ?? null;
    if (resumed) resumedView.current = true;
    let m: MapLibreMap;
    try {
      m = new MapLibreMap({
        container: holder.current,
        style: prefersDark() ? STYLE_DARK : STYLE_LIGHT,
        center: resumed?.center ?? (primary ? [primary[1], primary[0]] : [10, 45]),
        zoom: resumed?.zoom ?? 3,
        maxZoom: MAX_ZOOM,
        // Compact: OpenFreeMap/OSM attribution is required, so it can't be
        // removed — but it collapses to a single (i) the user can tap.
        attributionControl: { compact: true },
        // One finger scrolls the page; two fingers pan the map. Without this a
        // map inside a scrolling list traps the user's scroll.
        cooperativeGestures: true,
        // A rotated or pitched flight map is pure disorientation.
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
      });
    } catch {
      // Deliberately an effect: MapLibre needs a mounted DOM node, so
      // construction can only be attempted after commit — and a WebGL-less
      // browser throws right here. Falling back in render is not an option
      // because the failure isn't knowable until we try.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFailed(true);
      return;
    }
    m.addControl(new NavigationControl({ showCompass: false }), "top-right");
    m.on("load", () => setReady(true));
    // Only gestures carry an originalEvent; a programmatic fitBounds does not.
    m.on("dragstart", () => (userMoved.current = true));
    // moveend, not move: one write per gesture rather than sixty per second.
    m.on("moveend", () => {
      const c = m.getCenter();
      onViewChangeRef.current?.({ center: [c.lng, c.lat], zoom: m.getZoom() });
    });
    m.on("zoomstart", (e) => {
      if (e.originalEvent) userMoved.current = true;
    });
    // If the style never finishes loading (tile host down) MapLibre reports
    // nothing at all and just shows an empty canvas, so fail visibly rather
    // than leave a blank grey box. Only when the tab is actually visible:
    // MapLibre renders on requestAnimationFrame, which browsers do not run in
    // a background tab — so a page opened in one legitimately has an unloaded
    // style and must not be reported as broken.
    const giveUp = setTimeout(() => {
      if (document.visibilityState === "visible" && !m.isStyleLoaded()) {
        setFailed(true);
      }
    }, 10000);
    m.on("load", () => clearTimeout(giveUp));
    // The GPU can drop a WebGL context under memory pressure — likelier on a
    // mid-range phone with tiles loaded. Without this the canvas just goes
    // blank forever with no error state and no recovery.
    const canvas = m.getCanvas();
    const onLost = (e: Event) => {
      e.preventDefault();
      setFailed(true);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    m.on("error", (e) => {
      // Attaching any error listener suppresses MapLibre's own console output,
      // so log it — a silently swallowed map error is very hard to diagnose.
      console.error("[map]", e?.error ?? e);
      // Tile/style failures must never block the list — the map is not on the
      // conversion path.
      if (e?.error && String(e.error).includes("style")) setFailed(true);
    });
    map.current = m;
    // Dev-only handle. The map is a WebGL canvas: nothing about its state is
    // readable from the DOM, so without this a styling bug can only be guessed
    // at. Stripped from production builds by the env check.
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: unknown }).__map = m;
    }
    return () => {
      clearTimeout(giveUp);
      canvas.removeEventListener("webglcontextlost", onLost);
      m.remove();
      map.current = null;
    };
    // origin only seeds the initial centre; fitTo owns the viewport thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Repaint whenever the visible deals change, so every filter chip and price
  // Repaint on hover only — no source rebuild, no re-render of the markers.
  // Leaving fullscreen dismisses the panel: it is a fullscreen-only surface,
  // and a stale pick reappearing on the next open would be a ghost.
  //
  // Adjusted during render rather than in an effect — the pattern React
  // documents for state that derives from a prop, and the same one DealCard
  // uses for its focus handling. An effect here would set state after paint and
  // cascade a second render.
  const [wasFullscreen, setWasFullscreen] = useState(fullscreen);
  if (wasFullscreen !== fullscreen) {
    setWasFullscreen(fullscreen);
    if (picked) setPicked(null);
  }

  useEffect(() => {
    const m = map.current;
    if (!m || !ready || !m.getLayer(ROUTES_LAYER)) return;
    // Precedence: whatever the pointer is on wins, then the open panel. A
    // picked destination keeps its arc lit for as long as its card is open —
    // otherwise you open a flight and lose the one line that shows the route
    // you just chose.
    const paint = arcPaint(highlight ?? mapHover ?? picked);
    m.setPaintProperty(ROUTES_LAYER, "line-width", paint.width);
    m.setPaintProperty(ROUTES_LAYER, "line-opacity", paint.opacity);
  }, [highlight, mapHover, picked, ready]);

  // cap is reflected. The map itself never filters.
  useEffect(() => {
    const m = map.current;
    if (!m || !ready) return;

    // Arcs and unlabelled dots as GeoJSON layers rather than N overlays:
    // MapLibre draws each in a single GPU pass.
    const routes: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      // One arc per destination, drawn from THAT deal's departure airport.
      features: pins.flatMap((p) => {
        const from = originByCode.get(p.fromCode);
        if (!from) return [];
        return [
          {
            type: "Feature" as const,
            properties: { to: p.key },
            geometry: {
              type: "LineString" as const,
              coordinates: greatCircle([from[1], from[0]], [p.lon, p.lat]),
            },
          },
        ];
      }),
    };
    const dots: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: pins.slice(MAX_LABELS).map((p) => ({
        type: "Feature" as const,
        properties: {
          to: p.key,
          label: `${p.city} ${p.price} ${p.currency}`,
          price: p.price,
        },
        geometry: { type: "Point" as const, coordinates: [p.lon, p.lat] },
      })),
    };

    const routeSrc = m.getSource(ROUTES_SOURCE) as GeoJSONSource | undefined;
    if (routeSrc) {
      routeSrc.setData(routes);
    } else {
      m.addSource(ROUTES_SOURCE, { type: "geojson", data: routes });
      m.addLayer({
        id: ROUTES_LAYER,
        type: "line",
        source: ROUTES_SOURCE,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
          "line-color": "#f97316",
          // Deliberately faint at rest: at ~50 destinations these should read
          // as a fan radiating from home, not as 50 lines each asking to be
          // traced. One arc lifts out of it on hover.
          "line-width": arcPaint(null).width as number,
          "line-opacity": arcPaint(null).opacity as number,
        },
      });
    }

    const dotSrc = m.getSource(DOTS_SOURCE) as GeoJSONSource | undefined;
    if (dotSrc) {
      dotSrc.setData(dots);
    } else {
      m.addSource(DOTS_SOURCE, { type: "geojson", data: dots });
      // An invisible, generous target under the visible dot. MapLibre hit-tests
      // the rendered geometry, so without this the tap target IS the 4px dot —
      // well under the ~44px a fingertip needs, and every destination past the
      // first 12 labelled ones is one of these.
      m.addLayer({
        id: DOTS_HIT_LAYER,
        type: "circle",
        source: DOTS_SOURCE,
        paint: { "circle-radius": 14, "circle-color": "#000", "circle-opacity": 0 },
      });
      m.addLayer({
        id: DOTS_LAYER,
        type: "circle",
        source: DOTS_SOURCE,
        paint: {
          // 4px drawn, but the hit test uses the same radius — so a dot was a
          // 4px target on desktop and hopeless on a phone. Grown at higher
          // zooms where there is room, and paired with a transparent hit layer
          // below for the fingertip case.
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 8, 6],
          "circle-color": "#f97316",
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#fff",
        },
      });
      // The unlabelled dots were unreadable — a destination like New York was
      // an anonymous point. A symbol layer collides properly (unlike the HTML
      // markers), so names appear wherever there is room and as you zoom in.
      m.addLayer({
        id: DOTS_LABEL_LAYER,
        type: "symbol",
        source: DOTS_SOURCE,
        layout: {
          "text-field": ["get", "label"],
          "text-size": 11,
          "text-offset": [0, 1.1],
          "text-anchor": "top",
          "text-allow-overlap": false,
          // Cheapest wins the collision when two labels compete.
          "symbol-sort-key": ["get", "price"],
        },
        paint: {
          "text-color": "#111",
          "text-halo-color": "#fff",
          "text-halo-width": 1.5,
        },
      });
      // Dots are clickable too, so every destination can reach its deal.
      m.on("click", DOTS_HIT_LAYER, (e) => {
        const to = e.features?.[0]?.properties?.to;
        if (typeof to !== "string") return;
        if (fullscreenRef.current) setPicked(to);
        else onSelectRef.current?.(to);
      });
      m.on("mousemove", DOTS_HIT_LAYER, (e) => {
        m.getCanvas().style.cursor = "pointer";
        const to = e.features?.[0]?.properties?.to;
        setMapHover(typeof to === "string" ? to : null);
      });
      m.on("mouseleave", DOTS_HIT_LAYER, () => {
        m.getCanvas().style.cursor = "";
        setMapHover(null);
      });
    }

    for (const mk of markers.current) mk.remove();
    markers.current = [];

    const add = (el: HTMLElement, lon: number, lat: number) => {
      const mk = new Marker({ element: el }).setLngLat([lon, lat]).addTo(m);
      markers.current.push(mk);
    };

    for (const p of pins.slice(0, MAX_LABELS)) {
      const el = document.createElement("button");
      el.type = "button";
      // City + price. The price is what makes the map a tool rather than
      // decoration; the city saves you cross-referencing a dot against the list.
      const city = document.createElement("span");
      city.textContent = p.city;
      city.className = "text-black/60 dark:text-white/60";
      const price = document.createElement("span");
      price.textContent = `${p.price} ${p.currency}`;
      el.append(city, document.createTextNode(" "), price);
      // Chips overlap in the dense cluster, and MapLibre stacks markers purely
      // by DOM order — so a cheaper pin can sit permanently buried under a
      // dearer one. Raising the hovered/focused chip lets you read whichever
      // one you point at without zooming in.
      el.className =
        "flex items-center gap-1 whitespace-nowrap rounded-full border border-black/10 bg-white px-2 py-[3px] text-[11px] font-medium text-black shadow-sm " +
        "hover:z-10 hover:border-black/25 hover:shadow-md focus-visible:z-10 " +
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-500 " +
        "dark:border-white/15 dark:bg-neutral-900 dark:text-white dark:hover:border-white/35";
      el.setAttribute(
        "aria-label",
        `${p.city}, from ${p.price} ${p.currency}${p.extra ? `, ${p.extra} more weekends` : ""} — show in the list`
      );
      el.addEventListener("click", () => {
        if (fullscreenRef.current) setPicked(p.key);
        else onSelect?.(p.key);
      });
      // Pointer AND keyboard: the chips are focusable buttons, so tabbing the
      // map should light the same arc as hovering it.
      el.addEventListener("mouseenter", () => setMapHover(p.key));
      el.addEventListener("mouseleave", () => setMapHover(null));
      el.addEventListener("focus", () => setMapHover(p.key));
      el.addEventListener("blur", () => setMapHover(null));
      add(el, p.lon, p.lat);
    }

    for (const o of origins) {
      if (!o.coords) continue;
      const el = document.createElement("div");
      el.className =
        "flex h-4 w-4 items-center justify-center rounded-full border-2 border-neutral-900 bg-white dark:border-white dark:bg-neutral-900";
      el.setAttribute("aria-label", `Home airport ${o.code}`);
      el.title = o.code;
      add(el, o.coords[1], o.coords[0]);
    }
  }, [ready, pins, origins, originByCode, onSelect]);

  // Framing is its own effect keyed on the destinations actually shown, so a
  // re-render that doesn't change the set (opening Refine, toggling Sort) never
  // moves the camera.
  const framedKey = useMemo(
    () => framed.map((p) => p.key).sort().join(","),
    [framed]
  );
  useEffect(() => {
    // A resumed camera is the user's; only auto-fit a fresh map.
    if (!ready || userMoved.current || resumedView.current) return;
    fitTo(framed, true);
    // framedKey is the stable signature; `framed` itself changes identity often.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, framedKey]);

  const fitAll = useCallback(() => {
    userMoved.current = false;
    fitTo(pins, true);
  }, [fitTo, pins]);

  const summary = useMemo(() => {
    if (pins.length === 0) return "No destinations to map.";
    const c = pins[0];
    const from = origins.map((o) => o.code).join(", ");
    return `Map of ${pins.length} destination${pins.length === 1 ? "" : "s"} from ${from}. Cheapest is ${c.city} at ${c.price} ${c.currency}. The ${Math.min(MAX_LABELS, pins.length)} cheapest are labelled and can be focused to jump to their deal; the rest are shown as dots.`;
  }, [pins, origins]);

  if (failed) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-2xl border border-black/10 text-sm text-black/55 dark:border-white/10 dark:text-white/55">
        Map unavailable — the list below is unaffected.
      </div>
    );
  }

  return (
    <div
      ref={wrapper}
      // Mirrors the hovered destination into the DOM. The arc highlight itself
      // lives in a WebGL canvas, which is unreadable from a test and does not
      // paint at all in some automation browsers — this makes the wiring
      // assertable without reaching into the MapLibre instance.
      data-highlight={highlight ?? mapHover ?? picked ?? ""}
      className={
        fullscreen ? "flex h-full flex-col gap-1.5" : "flex flex-col gap-1.5"
      }
    >
      {/* Taller and closer to 4:3 on desktop: fitBounds fits BOTH axes, so a
          2.7:1 letterbox let the north–south spread set the zoom and left only
          ~180px of usable height for the whole of Europe. */}
      {/* The toggle sits ON the map, not under it. Below the canvas it read as
          a page control that happened to be nearby, and it pushed the map's
          own bottom edge away from the content it belongs to. Top-right is
          where every map in the world keeps this. */}
      <div
        className={
          fullscreen ? "relative min-h-0 flex-1" : "relative"
        }
      >
        <div
          ref={holder}
          data-map-canvas
          role="region"
          aria-label={summary}
          // NOT aria-hidden: the labelled pins are real buttons that jump to a
          // deal, so hiding the container would leave focusable controls inside
          // an aria-hidden subtree (WCAG 4.1.2) and strand keyboard users.
          className={
            fullscreen
              ? "h-full overflow-hidden"
              : "h-[260px] overflow-hidden rounded-2xl border border-black/10 sm:h-[380px] dark:border-white/10"
          }
        />
        {/* The list is behind the dialog in fullscreen, so a pin click had
            nowhere to land. This renders the REAL DealCard rather than a
            hand-rolled summary: a second implementation of the same row would
            drift from the list the first time either changed, and this is
            supposed to be "the item we have in the list". */}
        {fullscreen && pickedDeal && (
          <div className="absolute inset-x-3 bottom-3 z-10 flex max-h-[70%] flex-col overflow-hidden rounded-2xl border border-black/10 bg-white/95 text-black shadow-xl backdrop-blur-sm sm:left-auto sm:right-3 sm:w-[540px] sm:max-w-[calc(100%-1.5rem)] dark:border-white/15 dark:bg-neutral-900/95 dark:text-white">
            {/* Close only. The card below announces itself — a "From the list"
                label was a caption explaining something already obvious, and it
                cost a row of the panel's limited height. Kept as its own row
                rather than floating over the card, whose top-right corner is
                already the disclosure chevron. */}
            <div className="flex items-center justify-end border-b border-black/10 px-2 py-1.5 dark:border-white/10">
              <button
                type="button"
                onClick={() => setPicked(null)}
                aria-label="Close destination details"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-black/50 transition hover:bg-black/[0.06] hover:text-black dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              >
                ✕
              </button>
            </div>
            {/* Scrolls on its own: an expanded card is far taller than the
                space above the map's bottom edge. */}
            <div className="min-h-0 overflow-y-auto p-3">
              <DealCard deal={pickedDeal} />
            </div>
          </div>
        )}
        {/* One bar, top-left, because MapLibre's own zoom controls own the
            top-right. Wraps and scrolls rather than growing the map. */}
        <div className="pointer-events-none absolute top-2.5 right-14 left-2.5 z-10 flex flex-wrap items-start gap-1.5">
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              className="pointer-events-auto inline-flex min-h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white/90 px-3 text-xs font-medium text-black shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-white/15 dark:bg-neutral-900/90 dark:text-white dark:hover:bg-neutral-900"
            >
              {fullscreen ? "✕ Close map" : "⤢ Fullscreen"}
            </button>
          )}
          {hiddenByFraming > 0 && (
            <button
              type="button"
              onClick={fitAll}
              className="pointer-events-auto inline-flex min-h-9 items-center rounded-full border border-black/10 bg-white/90 px-3 text-xs font-medium text-black shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-white/15 dark:bg-neutral-900/90 dark:text-white dark:hover:bg-neutral-900"
            >
              Fit all — {hiddenByFraming} further afield
            </button>
          )}
        </div>

        {/* Filters live at the bottom centre, where a thumb reaches on a phone
            and where they cover the least map. Hidden while the detail panel is
            open — that panel occupies the same edge, and two stacked overlays
            at the bottom of a map is worse than one. `bottom-10` clears the
            tile attribution. */}
        {fullscreen && controls && !pickedDeal && (
          <div className="pointer-events-none absolute inset-x-0 bottom-10 z-[9] flex justify-center px-3">
            <div className="pointer-events-auto max-w-full overflow-x-auto rounded-2xl border border-black/10 bg-white/90 px-2.5 py-2 shadow-md backdrop-blur-sm dark:border-white/15 dark:bg-neutral-900/90">
              <div className="flex flex-nowrap">{controls}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
