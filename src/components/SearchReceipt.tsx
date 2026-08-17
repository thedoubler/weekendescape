"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WeekendStyle } from "@/lib/weekend";

export type StopMode = "any" | "direct";

export interface ReceiptValues {
  style: WeekendStyle;
  stopMode: StopMode;
  adults: number;
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

const STYLE_OPTS: { value: WeekendStyle; label: string }[] = [
  { value: "strict", label: "Fri–Sun" },
  { value: "frimon", label: "Fri–Mon" },
  { value: "loose", label: "Thu–Mon" },
];
const STOP_OPTS: { value: StopMode; label: string }[] = [
  { value: "any", label: "Any stops" },
  { value: "direct", label: "Direct only" },
];
const ADULT_OPTS = [1, 2, 3, 4];

type FacetKey = "style" | "stops" | "adults";

export function styleLabelOf(v: WeekendStyle): string {
  return STYLE_OPTS.find((o) => o.value === v)?.label ?? v;
}

interface Props {
  origins: string[];
  values: ReceiptValues;
  bridges: boolean;
  /** Live edit — updates the label immediately, without searching. */
  onChange: (patch: Partial<ReceiptValues>) => void;
  /** Commit — one search, on dismiss. Tapping 1→2→3→4 adults must not fire three. */
  onCommit: (patch: Partial<ReceiptValues>) => void;
  onEditOrigins: () => void;
  onToggleBridges: () => void;
}

export function SearchReceipt({
  origins,
  values,
  bridges,
  onChange,
  onCommit,
  onEditOrigins,
  onToggleBridges,
}: Props) {
  const [open, setOpen] = useState<FacetKey | null>(null);
  // Where the popover's tail should point. Read from the button at click time
  // rather than in a layout effect, so the tail never renders in the wrong
  // place for a frame.
  const [tailX, setTailX] = useState(0);
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
      setTailX(r.left - row.getBoundingClientRect().left + r.width / 2);
    }
    openedWith.current = { ...values };
    setOpen(key);
  }

  const originLabel =
    origins.length === 0
      ? "an airport"
      : origins.length === 1
        ? origins[0]
        : origins.join(" + ");

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
      className="relative flex flex-wrap items-baseline gap-x-1.5 gap-y-2 border-b border-black/[0.07] pb-3 text-[13px] dark:border-white/10"
    >
      <span className="text-black/45 dark:text-white/45">Searching</span>

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
      {facet("style", styleLabelOf(values.style))}
      <Sep />
      {facet("stops", values.stopMode === "direct" ? "direct" : "any stops")}
      <Sep />
      {facet("adults", values.adults === 1 ? "1 adult" : `${values.adults} adults`)}

      {/* Bridge days stays OUT of the facet list: it is a mode, not a value —
          it changes which searches run, not a parameter of one. A single tap
          with no options to choose between doesn't want a popover either, so
          it commits on the spot. */}
      <button
        type="button"
        role="switch"
        aria-checked={bridges}
        aria-label={reloadHint("Long weekends")}
        onClick={onToggleBridges}
        // Neutral when off, amber when on. It used to carry an amber OUTLINE
        // while off, which read as a warning — and on this page amber means
        // "changing this reloads the board", a claim an untouched toggle has no
        // business making. Filled-when-on is the same grammar the facet
        // triggers use; amber rather than their black keeps a mode distinct
        // from a filter.
        //
        // `before:` expands the hit box past the 24px ink, as elsewhere.
        className={`relative ml-auto inline-flex shrink-0 items-center gap-1.5 self-center rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] ${
          bridges
            ? "border-amber-400/70 bg-amber-100 text-amber-900 dark:border-amber-300/40 dark:bg-amber-300/20 dark:text-amber-50"
            : "border-black/15 text-black/65 hover:border-black/25 hover:bg-black/[0.04] dark:border-white/20 dark:text-white/65 dark:hover:border-white/30 dark:hover:bg-white/[0.07]"
        }`}
      >
        <CalendarPlusIcon
          className={`h-3.5 w-3.5 shrink-0 ${
            bridges
              ? "text-amber-700 dark:text-amber-200"
              : "text-black/40 dark:text-white/40"
          }`}
        />
        Long weekends
      </button>

      {open && (
        <Popover tailX={tailX}>
          {open === "style" && (
            <Options
              title="Weekend length"
              options={STYLE_OPTS}
              value={values.style}
              onPick={(v) => onChange({ style: v })}
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

// Inline SVG, currentColor — the same call DayBlocks.tsx made when it replaced
// the ✈ emoji: emoji do not render consistently across platforms and cannot
// take the theme. At 12px the 🌉 that used to sit here was a grey-orange
// smudge that fought the amber border around it.
//
// A calendar with a plus rather than a literal bridge: "bridge day" is the
// Romanian/Spanish idiom (punte, puente) and does not travel, whereas adding
// days to a weekend is what the mode actually does. The words carry the rest.
function CalendarPlusIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M8 2v4M16 2v4M3 10h18" />
      <path d="M12 14v5M9.5 16.5h5" />
    </svg>
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

function Popover({ tailX, children }: { tailX: number; children: React.ReactNode }) {
  return (
    <div
      role="dialog"
      // Anchored to the ROW, not to the button, so a facet near the right edge
      // of a 390px phone cannot push its own popover off screen. The tail is
      // what points at the button.
      className="absolute top-full left-0 z-40 mt-2 flex min-w-[190px] max-w-full flex-col gap-2.5 rounded-xl border border-black/10 bg-white p-3 shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)] dark:border-white/15 dark:bg-[#1b1e26]"
    >
      <span
        aria-hidden
        className="absolute -top-[5px] h-2 w-2 rotate-45 border-t border-l border-black/10 bg-white dark:border-white/15 dark:bg-[#1b1e26]"
        style={{ left: Math.max(10, tailX - 4) }}
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
}: {
  title: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onPick: (v: T) => void;
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
