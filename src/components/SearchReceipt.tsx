"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";

export type StopMode = "any" | "direct";

export interface ReceiptValues {
  style: WeekendStyle;
  stopMode: StopMode;
  adults: number;
  /** Long-weekend hunting. It lives in this object rather than as its own
   *  control because to a user it is not a mode running alongside "Fri–Sun" —
   *  it is another answer to the same question, "how long is the trip". */
  bridges: boolean;
}

// One line of prose that IS the control surface: "Searching CLJ · Fri–Sun ·
// direct · 1 adult". It replaces a ~300px panel of labelled segmented controls
// with a sentence, and it replaces the commit bar too — because at ~2.3s a
// single edit does not need to be queued behind a button.
//
// The rule the whole top of the page now runs on: THE RECEIPT RELOADS, THE
// FILTERS ARE FREE. Everything in here costs an upstream call, which is what
// the amber dotted underline marks. Everything below it (month, region, price)
// is an Array.filter over data already in memory, and carries no rule at all.
//
// That mark deliberately does not print a duration. A measured 14 searches came
// in at a 2311ms mean; "about 2 seconds" would make an upstream call sound free
// when it still costs quota and still replaces the board. Category, not
// seconds — and if production ever measures much worse, the fix is to move the
// commit from popover-dismiss back to an explicit button, not to add a number.

// The three fixed shapes, plus "bridges" — which is not a shape at all but a
// search strategy. They share a control because they answer one question: how
// long is the trip. As a separate pill, "Long weekends" read as a filter
// running on top of "Fri–Sun" rather than instead of it.
type StyleChoice = WeekendStyle | "bridges";
const STYLE_OPTS: { value: StyleChoice; label: string }[] = [
  { value: "strict", label: "Fri–Sun" },
  { value: "frimon", label: "Fri–Mon" },
  { value: "loose", label: "Thu–Mon" },
  { value: "bridges", label: "Long weekends" },
];
const STOP_OPTS: { value: StopMode; label: string }[] = [
  { value: "any", label: "Any stops" },
  { value: "direct", label: "Direct only" },
];
const ADULT_OPTS = [1, 2, 3, 4];

// One sentence, used on the toggle and again beside the count once the mode is
// on. It has to carry the WHY: "long weekends" describes the result, not the
// trick, and the trick — a public holiday doing the work of a day's leave — is
// the reason anyone would want it.
export const BRIDGE_HELP =
  "Only weekends a public holiday stretches, so one day off can buy three or four.";

type FacetKey = "style" | "stops" | "adults";

export function styleLabelOf(v: StyleChoice): string {
  return STYLE_OPTS.find((o) => o.value === v)?.label ?? v;
}

interface Props {
  origins: string[];
  /** IATA → city in words ("CLJ" → "Cluj-Napoca"), harvested from the deals
   *  the server sent back — cityFrom is resolved server-side, so no airport
   *  table has to reach the client bundle. Codes are an aviation dialect;
   *  people fly from cities. Falls back to the code until deals land. */
  originCities?: Record<string, string>;
  values: ReceiptValues;
  /** Live edit — updates the label immediately, without searching. */
  onChange: (patch: Partial<ReceiptValues>) => void;
  /** Commit — one search, on dismiss. Tapping 1→2→3→4 adults must not fire three. */
  onCommit: (patch: Partial<ReceiptValues>) => void;
  onEditOrigins: () => void;
}

export function SearchReceipt({
  origins,
  originCities,
  values,
  onChange,
  onCommit,
  onEditOrigins,
}: Props) {
  const [open, setOpen] = useState<FacetKey | null>(null);
  // Where the popover's tail should point, as a signed pixel offset from the
  // ROW'S CENTRE. Read from the button at click time rather than in a layout
  // effect, so the tail never renders in the wrong place for a frame.
  //
  // Measured from the centre rather than the left edge because the popover is
  // now centred on the row (the whole masthead is centred). Storing the offset
  // from the centre means the tail can be placed with `calc(50% + offset)` and
  // never needs the popover's own width measured.
  const [tailOffset, setTailOffset] = useState(0);
  const rowRef = useRef<HTMLDivElement>(null);
  // The values as they were when the popover opened. Closing compares against
  // this, so opening a facet and picking what was already selected costs
  // nothing.
  const openedWith = useRef<ReceiptValues | null>(null);

  const close = useCallback(() => {
    const before = openedWith.current;
    openedWith.current = null;
    setOpen(null);
    if (!before) return;
    const patch: Partial<ReceiptValues> = {};
    if (before.style !== values.style) patch.style = values.style;
    if (before.stopMode !== values.stopMode) patch.stopMode = values.stopMode;
    if (before.adults !== values.adults) patch.adults = values.adults;
    if (before.bridges !== values.bridges) patch.bridges = values.bridges;
    if (Object.keys(patch).length > 0) onCommit(patch);
  }, [values, onCommit]);

  // Dismissal is the commit, so both routes out — Escape and a click anywhere
  // else — have to run through the same path.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rowRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  function toggle(key: FacetKey, e: React.MouseEvent<HTMLButtonElement>) {
    if (open === key) {
      close();
      return;
    }
    // Another facet may be open; commit it before switching.
    if (open) close();
    const btn = e.currentTarget;
    const row = rowRef.current;
    if (row) {
      const r = btn.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();
      const btnCentre = r.left - rowRect.left + r.width / 2;
      setTailOffset(btnCentre - rowRect.width / 2);
    }
    openedWith.current = { ...values };
    setOpen(key);
  }

  const cityOf = (code: string) => originCities?.[code] ?? code;
  const originLabel =
    origins.length === 0
      ? "an airport"
      : origins.length === 1
        ? cityOf(origins[0])
        : origins.map(cityOf).join(" + ");

  const facet = (key: FacetKey, label: string) => (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open === key}
      aria-label={reloadHint(label)}
      onClick={(e) => toggle(key, e)}
      className={`relative -mx-0.5 rounded px-0.5 pb-0.5 font-semibold whitespace-nowrap transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] ${
        open === key
          ? "bg-amber-500/10 text-black dark:bg-amber-300/15 dark:text-white"
          : "text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
      } border-b-2 border-dotted border-amber-700 dark:border-amber-400`}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={rowRef}
      // 15px, up from 13. This line is the only statement of what the board is
      // currently showing — origin, trip shape, party size — and every value in
      // it is a control. At 13px it read as fine print beside a 46px wordmark,
      // which is the wrong signal for the most interactive row on the page.
      // Centred to sit on the masthead's axis — see the header comment in
      // page.tsx for why the whole block is centred. `justify-center` only
      // moves the row; each value keeps its own popover anchored to itself.
      className="relative flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-2 border-b border-black/[0.07] pb-3 text-center text-[15px] dark:border-white/10"
    >
      {/* "From", not "Searching": the reference deals page says "from <city>",
          it answers the headline's "Pick your airport" directly, and
          "Searching" read as an activity still in progress over a board that
          is already the answer. */}
      <span className="text-black/45 dark:text-white/45">From</span>

      {/* Origin is not a picker — it needs autocomplete, up to three chips and
          a location prompt — so it opens the sheet instead of a popover. */}
      <button
        type="button"
        onClick={onEditOrigins}
        aria-label={reloadHint(originLabel)}
        className="relative -mx-0.5 rounded border-b-2 border-dotted border-amber-700 px-0.5 pb-0.5 before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] font-semibold whitespace-nowrap text-black/70 transition-colors hover:text-black dark:border-amber-400 dark:text-white/70 dark:hover:text-white"
      >
        {originLabel}
      </button>

      <Sep />
      {facet("style", styleLabelOf(values.bridges ? "bridges" : values.style))}
      <Sep />
      {facet("stops", values.stopMode === "direct" ? "direct" : "any stops")}
      <Sep />
      {facet("adults", values.adults === 1 ? "1 adult" : `${values.adults} adults`)}

      {open && (
        <Popover tailOffset={tailOffset}>
          {open === "style" && (
            <Options
              title="Trip length"
              options={STYLE_OPTS}
              value={values.bridges ? "bridges" : values.style}
              // Picking a shape turns bridge-hunting off; picking bridges keeps
              // the shape underneath, so switching back lands where you were.
              onPick={(v) =>
                onChange(
                  v === "bridges" ? { bridges: true } : { style: v, bridges: false }
                )
              }
              hint={{ value: "bridges", text: BRIDGE_HELP }}
            />
          )}
          {open === "stops" && (
            <Options
              title="Stops"
              options={STOP_OPTS}
              value={values.stopMode}
              onPick={(v) => onChange({ stopMode: v })}
            />
          )}
          {open === "adults" && (
            <Options
              title="Adults"
              options={ADULT_OPTS.map((n) => ({ value: n, label: String(n) }))}
              value={values.adults}
              onPick={(v) => onChange({ adults: v })}
            />
          )}
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-300/90">
            Reloads the board when you close this
          </p>
        </Popover>
      )}
    </div>
  );
}

function Sep() {
  return (
    <span aria-hidden className="text-black/25 dark:text-white/25">
      ·
    </span>
  );
}

// The hint that used to live here as a repeated `sr-only` span is now part of
// each control's accessible name instead. Same information to a screen reader,
// but `sr-only` text is real text: it rode along in every copy-paste and every
// text extraction, so the line came out as "CLJ (reloads results) · Fri–Sun
// (reloads results) · …" — five times, in a product whose whole SEO/GEO problem
// is what a text-only reader sees. Each accessible name still STARTS with the
// visible label, which is what WCAG 2.5.3 (Label in Name) requires.
function reloadHint(label: string): string {
  return `${label} — changing this reloads results`;
}

function Popover({
  tailOffset,
  children,
}: {
  tailOffset: number;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      // CENTRED ON THE ROW. Still anchored to the row and not to the button —
      // that is what stops a facet near the right edge of a 390px phone from
      // pushing its own popover off screen — but centred rather than flush
      // left, because the row it hangs from is now centred itself. Left-0 under
      // a centred row put the panel visibly off to one side.
      className="absolute top-full left-1/2 z-40 mt-2 flex min-w-[190px] max-w-full -translate-x-1/2 flex-col gap-2.5 rounded-xl border border-black/10 bg-white p-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)] dark:border-white/15 dark:bg-[#1b1e26]"
    >
      <span
        aria-hidden
        className="absolute -top-[5px] h-2 w-2 rotate-45 border-t border-l border-black/10 bg-white dark:border-white/15 dark:bg-[#1b1e26]"
        // `clamp` keeps the tail inside its own panel without measuring the
        // panel: the middle term places it under the button, and the two bounds
        // stop it escaping a rounded corner when the button is far off centre.
        style={{
          left: `clamp(10px, calc(50% + ${Math.round(tailOffset)}px - 4px), calc(100% - 18px))`,
        }}
      />
      {children}
    </div>
  );
}

function Options<T extends string | number>({
  title,
  options,
  value,
  onPick,
  hint,
}: {
  title: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
  /** Explanatory text for one option whose label names a result rather than a
   *  mechanism — "Long weekends" says what you get, not that a public holiday
   *  is doing the work. */
  hint?: { value: T; text: string };
}) {
  return (
    <>
      <h5 className="text-[10px] font-bold tracking-[0.08em] text-black/45 uppercase dark:text-white/45">
        {title}
      </h5>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            title={hint && hint.value === o.value ? hint.text : undefined}
            aria-label={
              hint && hint.value === o.value ? `${o.label}. ${hint.text}` : undefined
            }
            onClick={() => onPick(o.value)}
            className={`rounded-full border px-3 py-1.5 text-[12.5px] whitespace-nowrap transition-colors ${
              o.value === value
                ? "border-transparent bg-neutral-900 font-semibold text-white dark:bg-white dark:text-black"
                : "border-black/12 text-black/65 hover:bg-black/[0.04] dark:border-white/15 dark:text-white/65 dark:hover:bg-white/[0.06]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </>
  );
}
