"use client";

import { useCallback, useRef, useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  /** Which regional holidays count as the traveller's own, bridge mode only.
   *  null = automatic (the server infers from the home airports); "national"
   *  = explicitly none; an ISO-3166-2 code = that region. */
  region: string | null;
}

/** What the server used and what it offers — see WeekendSearchResult. */
export interface HomeRegionInfo {
  used: string | null;
  usedName: string | null;
  options: { code: string; name: string }[];
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

// The region picker's why, in one sentence. The mechanism (regional holidays
// exist and only count if they're yours) is invisible from the label alone.
export const REGION_HELP =
  "National holidays always count. Set the region you live in and its own holidays count too.";

type FacetKey = "style" | "stops" | "adults" | "region";

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
  /** Region facts from the last bridge-mode response; null hides the region
   *  control (bridges off, or a home country with no regional holidays). */
  homeRegion?: HomeRegionInfo | null;
  /** The applied search was a meet-up — the receipt must say so, because the
   *  board's prices are totals for the whole party. Tapping it opens the
   *  sheet, where the toggle lives. */
  meetUp?: boolean;
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
  homeRegion,
  meetUp = false,
  onChange,
  onCommit,
  onEditOrigins,
}: Props) {
  const [open, setOpen] = useState<FacetKey | null>(null);
  // The values as they were when the popover opened. Closing compares against
  // this, so opening a facet and picking what was already selected costs
  // nothing.
  const openedWith = useRef<ReceiptValues | null>(null);

  // APPLY is the commit — reversed from the original dismiss-commits design
  // by request ("apply button works better"). The popover still edits live
  // (that is what makes the label update as you pick), so both ways out have
  // to be explicit about the pending patch: Apply commits it and reloads;
  // Escape, the backdrop and re-tapping the facet all CANCEL — they put the
  // opening values back, which is what dismissal means everywhere else on
  // the web. (Radix owns dismissal now, so switching facets is an
  // outside-click on the open one: it cancels that facet's pending edit
  // before the next opens. One popover, one editing session.)
  //
  // Positioning is Radix's too — this replaced a hand-rolled version that
  // centred the panel on the ROW and computed its own tail offset because a
  // per-button anchor could push past the viewport edge. Collision shifting
  // is the actual fix for that problem, and it comes free here; the "off"
  // placements the owner saw were the workaround's residue.
  const close = useCallback(
    (commit = true) => {
      const before = openedWith.current;
      openedWith.current = null;
      setOpen(null);
      if (!before) return;
      const diff: Partial<ReceiptValues> = {};
      if (before.style !== values.style)
        diff.style = commit ? values.style : before.style;
      if (before.stopMode !== values.stopMode)
        diff.stopMode = commit ? values.stopMode : before.stopMode;
      if (before.adults !== values.adults)
        diff.adults = commit ? values.adults : before.adults;
      if (before.bridges !== values.bridges)
        diff.bridges = commit ? values.bridges : before.bridges;
      if (before.region !== values.region)
        diff.region = commit ? values.region : before.region;
      if (Object.keys(diff).length === 0) return;
      // onChange rewrites the label without searching; onCommit reloads.
      if (commit) onCommit(diff);
      else onChange(diff);
    },
    [values, onChange, onCommit]
  );

  // Radix drives open state: `true` from a trigger click opens (capturing
  // the before-image), `false` from any dismissal cancels.
  function onOpenChange(key: FacetKey, next: boolean) {
    if (next) {
      openedWith.current = { ...values };
      setOpen(key);
    } else {
      close(false);
    }
  }

  const cityOf = (code: string) => originCities?.[code] ?? code;
  const originLabel =
    origins.length === 0
      ? "an airport"
      : origins.length === 1
        ? cityOf(origins[0])
        : origins.map(cityOf).join(" + ");

  function panel(key: FacetKey) {
    if (key === "style")
      return (
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
      );
    if (key === "region" && homeRegion)
      return (
        <Options
          title="Whose holidays count"
          options={[
            { value: "national", label: "National only" },
            ...homeRegion.options.map((o) => ({
              value: o.code,
              label: o.name,
            })),
          ]}
          // While the user hasn't chosen (region null), highlight what the
          // server actually used — the inferred region, or national.
          value={values.region ?? homeRegion.used ?? "national"}
          onPick={(v) => onChange({ region: v })}
          hint={{ value: "national", text: REGION_HELP }}
        />
      );
    if (key === "stops")
      return (
        <Options
          title="Stops"
          options={STOP_OPTS}
          value={values.stopMode}
          onPick={(v) => onChange({ stopMode: v })}
        />
      );
    if (key === "adults")
      return (
        <Options
          title={meetUp && origins.length > 1 ? "Adults from each city" : "Adults"}
          options={ADULT_OPTS.map((n) => ({ value: n, label: String(n) }))}
          value={values.adults}
          onPick={(v) => onChange({ adults: v })}
        />
      );
    return null;
  }

  // One Radix popover per facet: the trigger is the receipt word, the
  // content is that facet's panel plus Apply. aria-expanded/haspopup come
  // from Radix now, so the button no longer sets its own.
  const facet = (key: FacetKey, label: string) => (
    <Popover open={open === key} onOpenChange={(o) => onOpenChange(key, o)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={reloadHint(label)}
          className={`relative -mx-0.5 rounded px-0.5 pb-0.5 font-semibold whitespace-nowrap transition-colors before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] ${
            open === key
              ? "bg-amber-500/10 text-black dark:bg-amber-300/15 dark:text-white"
              : "text-black/70 hover:text-black dark:text-white/70 dark:hover:text-white"
          } border-b-2 border-dotted border-amber-700 dark:border-amber-400`}
        >
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent
        sideOffset={8}
        collisionPadding={12}
        className="w-max min-w-[260px] max-w-[min(92vw,26rem)] rounded-xl border border-black/10 bg-white p-3 text-center shadow-[0_18px_40px_-14px_rgba(0,0,0,0.35)] ring-0 motion-reduce:animate-none dark:border-white/15 dark:bg-[#1b1e26]"
      >
        {panel(key)}
        {/* Outlined, not ink: the SELECTED chip above is the panel's one
            solid element. Apply anchors by being the only full-width
            control. */}
        <button
          type="button"
          onClick={() => close(true)}
          className="mt-0.5 inline-flex h-9 w-full items-center justify-center rounded-full border border-black/15 text-sm font-medium text-black transition hover:bg-black/[0.04] dark:border-white/25 dark:text-white dark:hover:bg-white/[0.06]"
        >
          Apply
        </button>
      </PopoverContent>
    </Popover>
  );

  return (
    <div
      // 15px, up from 13. This line is the only statement of what the board is
      // currently showing — origin, trip shape, party size — and every value in
      // it is a control. At 13px it read as fine print beside a 46px wordmark,
      // which is the wrong signal for the most interactive row on the page.
      // Centred to sit on the masthead's axis — see the header comment in
      // page.tsx for why the whole block is centred. `justify-center` only
      // moves the row; each value keeps its own popover anchored to itself.
      // No rule under the row (removed by request): the whitespace and the
      // sticky filter bar's own top edge already separate it from the board.
      className="relative flex flex-wrap items-baseline justify-center gap-x-2.5 gap-y-2 pb-3 text-center text-[15px]"
    >
      {/* "From", not "Searching": the reference deals page says "from <city>",
          it answers the headline's "Pick your airport" directly, and
          "Searching" read as an activity still in progress over a board that
          is already the answer. */}
      <span className="text-muted-foreground">From</span>

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

      {/* Meet-up rewrites what every price below means (a total for the whole
          party), so the receipt says it beside the origins it applies to.
          Same dotted-underline dialect; it opens the sheet, where the toggle
          lives. */}
      {meetUp && origins.length > 1 && (
        <span className="inline-flex items-baseline gap-x-2.5">
          <Sep />
          <button
            type="button"
            onClick={onEditOrigins}
            aria-label={reloadHint("meeting up")}
            className="relative -mx-0.5 rounded border-b-2 border-dotted border-amber-700 px-0.5 pb-0.5 before:absolute before:inset-x-0 before:-inset-y-2 before:content-[''] font-semibold whitespace-nowrap text-black/70 transition-colors hover:text-black dark:border-amber-400 dark:text-white/70 dark:hover:text-white"
          >
            meeting up
          </button>
        </span>
      )}

      {/* Each separator travels with the value AFTER it, so a wrap can never
          strand one at the end of a line. Measured at 390px, where the row
          genuinely does not fit on one line: it broke as
          "From Cluj-Napoca · Fri–Sun · direct ·" / "1 adult" — a dot pointing at
          nothing, and a value that read as a fragment rather than a
          continuation. Grouped, the break reads "· 1 adult". The orphan line
          stays (four values will not fit a phone at 15px, and this row is
          deliberately not shrunk); what goes away is the dangling mark. */}
      {[
        facet("style", styleLabelOf(values.bridges ? "bridges" : values.style)),
        // The region only exists as a fact once a bridge search has answered
        // (that answer carries which regions the home country even has), and
        // only matters while bridges is on. Everyone else never sees it.
        ...(values.bridges && homeRegion && homeRegion.options.length > 0
          ? [facet("region", regionLabel(values.region, homeRegion))]
          : []),
        facet("stops", values.stopMode === "direct" ? "direct" : "any stops"),
        // In meet-up mode "1 adult" would undercount the party: adults means
        // adults PER CITY there (each leg is priced for that many people from
        // that origin), and the label says so.
        facet(
          "adults",
          meetUp && origins.length > 1
            ? values.adults === 1
              ? "1 adult each"
              : `${values.adults} adults each`
            : values.adults === 1
              ? "1 adult"
              : `${values.adults} adults`
        ),
      ].map((control, i) => (
        <span key={i} className="inline-flex items-baseline gap-x-2.5">
          <Sep />
          {control}
        </span>
      ))}


    </div>
  );
}

// The printed assumption: whose holidays the search counted. Live edits win
// (the label updates as you pick, like every facet); before any choice the
// label states what the server inferred, which is the point — a guess said
// out loud is correctable, a silent one is not.
function regionLabel(
  chosen: string | null,
  info: HomeRegionInfo
): string {
  const code = chosen ?? info.used;
  if (!code || code === "national") return "national holidays";
  const name =
    info.options.find((o) => o.code === code)?.name ??
    (code === info.used ? info.usedName : null) ??
    code;
  return `holidays for ${name}`;
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
  // The hint used to live in `title` and an aria-label, which meant a sighted
  // touch user — most of them — could not reach it at all: there is no hover on
  // a phone, and "Long weekends" names the result rather than the mechanism, so
  // the one option that needs explaining was the one nobody could get explained.
  // Now it is visible text, shown BEFORE the choice rather than after it, and
  // tied to its option with aria-describedby so a screen reader still hears the
  // two together without the label repeating the whole sentence.
  const hintId = hint ? `receipt-hint-${String(hint.value)}` : undefined;
  return (
    <>
      <h5 className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground uppercase">
        {title}
      </h5>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            aria-pressed={o.value === value}
            aria-describedby={
              hint && hint.value === o.value ? hintId : undefined
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
      {hint && (
        <p id={hintId} className="text-[11px] leading-snug text-muted-foreground">
          {hint.text}
        </p>
      )}
    </>
  );
}
