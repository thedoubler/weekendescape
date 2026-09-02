"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

interface Suggestion {
  code: string;
  name: string;
  city: string;
  country: string;
}

// Session-lived cache of autocomplete results by lowercased term, so retyping or
// backspacing to a prior query is instant and doesn't re-hit the API.
const TERM_CACHE = new Map<string, Suggestion[]>();

const MAX_SUGGESTIONS = 8;

function TakeoffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 21h20" />
      <path d="M4.5 15.5 3 11l2-.5 2.2 2.4 4.3-1.2L8 6.2l2.3-.6 5 5 4.2-1.1a1.9 1.9 0 0 1 1 3.7L5.9 16.9a1 1 0 0 1-1.2-.6z" />
    </svg>
  );
}

export function AirportInput({
  value,
  onSearch,
  inputRef,
  autoFocus,
  chips = [],
  onRemoveChip,
  disabled = false,
  placeholder = "Airport or city, e.g. Barcelona",
  flushRef,
}: {
  value: string;
  /** Filled with a function that resolves whatever is typed right now. The
   *  parent calls it on the way out through an explicit control (Done), so the
   *  commit lands before the dialog's close handler reads the result. */
  flushRef?: RefObject<(() => void) | null>;
  /** Renders the `autofocus` attribute. A modal <dialog> honours autofocus on
   *  a descendant in preference to its own "first focusable child" rule —
   *  which here was the ✕ that removes an airport chip. */
  autoFocus?: boolean;
  onSearch: (code: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  // Already-selected airports, rendered inside the field so the whole thing
  // reads as one control rather than a list plus a separate box.
  chips?: string[];
  onRemoveChip?: (code: string) => void;
  // At the cap: the text input stops accepting new entries, but the chips (and
  // their remove buttons) stay usable.
  disabled?: boolean;
  placeholder?: string;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const lastSearched = useRef(value);

  // Reflect external changes (geolocation, saved home). Adopting the new prop
  // during render keeps the field from painting one frame of the stale code.
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setQuery(value);
  }

  // The "already searched" marker follows the committed prop. It stays in an
  // effect because writing a ref during render is unsafe under concurrent
  // rendering, and this runs before the debounce effect below reads it.
  useEffect(() => {
    lastSearched.current = value;
  }, [value]);

  // Debounced suggestion fetch — cached by term, cancels the in-flight request
  // when the query changes so stale responses can't overwrite newer ones.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q.toUpperCase() === lastSearched.current) {
      setSuggestions([]);
      setNoResults(false);
      setLoading(false);
      return;
    }
    const key = q.toLowerCase();
    const memo = TERM_CACHE.get(key);
    // Deliberately an effect: this is the debounce/cancellation path, and
    // TERM_CACHE is module state that a previous keystroke's in-flight request
    // can populate after this render. Deriving the memo during render would
    // read a cache that is not yet settled.
    if (memo) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSuggestions(memo);
      setNoResults(memo.length === 0);
      setActive(-1);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?term=${encodeURIComponent(q)}`, {
          signal: ctrl.signal,
        });
        const body = await res.json();
        const list: Suggestion[] = Array.isArray(body.airports)
          ? body.airports
          : [];
        TERM_CACHE.set(key, list);
        setSuggestions(list);
        setNoResults(list.length === 0);
        setActive(-1);
        setLoading(false);
      } catch {
        // Aborted (query moved on) or network error — leave prior suggestions.
      }
    }, 220);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  const shown = suggestions.slice(0, MAX_SUGGESTIONS);

  // Token mode: chips are managed by the parent, so a selection empties the
  // text input ready for the next entry instead of leaving the code behind.
  const tokenMode = Boolean(onRemoveChip);

  function fire(code: string) {
    const c = code.trim().toUpperCase();
    setQuery(tokenMode ? "" : c);
    lastSearched.current = c;
    setOpen(false);
    setSuggestions([]);
    setNoResults(false);
    onSearch(c);
  }

  function choose(s: Suggestion) {
    fire(s.code);
  }

  // Only submit something we can actually search: an exact suggestion, a bare
  // 3-letter IATA code, or (for a typed city name) the top suggestion. A typo
  // with no matches does nothing rather than searching e.g. flyFrom=BARCELONA.
  //
  // `guess` is what separates an EXPLICIT commit from an incidental one, and it
  // is the whole fix for a bug that put an airport nobody chose onto the board:
  // typing "vien" and pressing Escape closed the dialog, and the blur behind it
  // resolved the half-typed word to the top suggestion — VIE was added, the
  // receipt read "Cluj-Napoca + VIE", the URL still said from=CLJ and the board
  // still showed CLJ-only data. Three states disagreeing, from a keystroke that
  // means "abandon this".
  //
  // So: Enter, a click on a suggestion, and Done all mean "use your best
  // match", and pass guess. Losing focus never does — it commits only text that
  // resolves with no interpretation (an exact code, or an exact suggestion).
  function submitTyped({ guess }: { guess: boolean }) {
    setOpen(false);
    const raw = query.trim();
    if (!raw) return;
    const upper = raw.toUpperCase();
    if (upper === lastSearched.current) return;
    const exact = suggestions.find((s) => s.code.toUpperCase() === upper);
    if (exact) return fire(exact.code);
    if (/^[A-Z]{3}$/.test(upper)) return fire(upper);
    if (!guess) return;
    if (shown.length > 0) return fire(shown[0].code);
    // Unresolvable — keep the field open with the no-results hint, don't search.
    setOpen(true);
  }

  // Set by Escape on its way out of the field, cleared by the next keystroke.
  // The blur it triggers arrives a tick later, by which time the reason for it
  // is gone; without this flag that blur cannot tell "the user left" from "the
  // user cancelled", and the pending text would survive as a committed airport.
  const abandoned = useRef(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (blurTimer.current) clearTimeout(blurTimer.current);
    },
    []
  );

  // Called by the sheet's Done button, which has to resolve the field BEFORE
  // the dialog closes: the close handler compares origins to decide whether to
  // search, and a commit that lands after that comparison changes the receipt
  // without reloading the board.
  //
  // No dependency array, so the stored closure is refreshed after every render
  // and always sees the current query and suggestions. It is an effect rather
  // than a plain assignment because writing a ref during render is unsafe under
  // concurrent rendering — the same reason `lastSearched` above is set in one.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = () => submitTyped({ guess: true });
    return () => {
      flushRef.current = null;
    };
  });

  const showList = open && shown.length > 0;
  const showEmpty =
    open && !loading && shown.length === 0 && noResults && query.trim().length >= 2;

  return (
    <div className="relative w-full">
      {/* One field: the chips sit inside the same bordered shell as the text
          input, and the shell takes the focus ring. */}
      <div
        onClick={() => inputRef?.current?.focus()}
        // White rather than a grey wash: on the panel's tinted card, a filled
        // field read as disabled. The accent is spent here, on focus, where it
        // means something — the board itself is deliberately neutral.
        // NO focus ring, by request — the accent halo that replaced the black
        // rectangle was still too loud for a field that is autofocused inside
        // a one-field dialog. The caret is the focus indicator here: the sheet
        // has a single input, so "which field am I in" has only one answer.
        // The suppression of the global outline (focus-visible:outline-none on
        // the input + the @layer fix in globals.css) is what keeps this from
        // regressing to the double ring it once had.
        className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-black/[0.12] bg-white px-3 py-2.5 transition dark:border-white/20 dark:bg-white/[0.07]"
      >
        <TakeoffIcon className="mr-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
        {chips.map((code) => (
          <span
            key={code}
            className="inline-flex items-center gap-0.5 rounded-lg border border-black/[0.08] bg-black/[0.05] py-1 pr-1 pl-2.5 text-sm font-medium tracking-wide tabular-nums dark:border-white/20 dark:bg-white/[0.16]"
          >
            {code}
            {onRemoveChip && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemoveChip(code);
                }}
                aria-label={`Remove ${code}`}
                // h-7 w-7 with -my-1: a 28px target (was a 20px speck —
                // reported too small to hit) whose negative margin keeps the
                // chip's height exactly as it was. text-lg scales the glyph
                // with the box.
                className="-my-1 flex h-7 w-7 items-center justify-center rounded-full text-lg leading-none text-muted-foreground transition hover:bg-black/10 hover:text-black dark:hover:bg-white/15 dark:hover:text-white"
              >
                ×
              </button>
            )}
          </span>
        ))}
      <input
        ref={inputRef}
        disabled={disabled}
        value={query}
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
        aria-controls="airport-suggestions"
        aria-activedescendant={
          active >= 0 ? `airport-opt-${active}` : undefined
        }
        inputMode="search"
        enterKeyHint="search"
        // The placeholder was the only accessible name this field had, and a
        // placeholder disappears the moment anyone types — so a screen-reader
        // user who paused mid-entry had an unlabelled text box. It also shifts
        // ("Add another…", "Up to 3 airports") as chips accumulate, which is
        // status, not a name. A stable name, spoken independently of state.
        aria-label="Airport or city"
        onChange={(e) => {
          abandoned.current = false;
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => (suggestions.length > 0 || noResults) && setOpen(true)}
        // The delay lets a click on a suggestion win the race against the blur
        // it causes. It never guesses (see submitTyped), and after Escape it
        // discards instead: the field goes back to what the board is actually
        // searching rather than keeping text that will never be committed.
        onBlur={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          blurTimer.current = setTimeout(() => {
            setOpen(false);
            if (abandoned.current) {
              abandoned.current = false;
              setQuery(tokenMode ? "" : value);
              return;
            }
            submitTyped({ guess: false });
          }, 150);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? shown.length - 1 : a - 1));
          } else if (e.key === "Enter") {
            if (open && active >= 0 && shown[active]) {
              e.preventDefault();
              choose(shown[active]);
            } else {
              submitTyped({ guess: true });
            }
          } else if (e.key === "Escape") {
            if (showList || showEmpty) {
              // The standard combobox contract: the first Escape dismisses the
              // list only. Without preventDefault it also reached the <dialog>
              // and closed the whole sheet in one press.
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
              setActive(-1);
            } else {
              // Nothing left to dismiss here, so this Escape belongs to the
              // dialog. Flag the blur that follows as an abandonment.
              abandoned.current = true;
            }
          } else if (
            e.key === "Backspace" &&
            query === "" &&
            chips.length > 0 &&
            onRemoveChip
          ) {
            // Standard token-input behaviour: backspace on an empty field takes
            // the last chip rather than doing nothing.
            onRemoveChip(chips[chips.length - 1]);
          }
        }}
        placeholder={placeholder}
        // Scoped to a modal dialog the user just opened in order to type into,
        // which is the one place autofocus is correct.
        autoFocus={autoFocus}
        // The attribute, not a class, is what turns the global focus outline
        // off — see the rule in globals.css for why the class-based attempts
        // lost. Without it the sheet opens with a hard black 2px rectangle
        // drawn tight around this input.
        data-no-focus-ring
        // 16px on phones, and that number is load-bearing: iOS Safari force-zooms
        // the page when a focused input's font-size is below 16px, and this
        // input AUTOFOCUSES when the sheet opens — so tapping the origin zoomed
        // the viewport, and the zoom outlives the dialog, leaving the whole
        // board slightly magnified with sideways pan. Reported as "it zooms a
        // bit in the field" and, earlier, as phantom horizontal scroll on
        // mobile. 15px returns from `sm` up, where no browser pulls this trick.
        className="min-w-[10ch] flex-1 bg-transparent px-1.5 py-1 text-base outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed sm:text-[15px]"
      />
      </div>
      {showList && (
        <ul
          id="airport-suggestions"
          role="listbox"
          className="absolute inset-x-0 z-20 mt-1 rounded-lg border border-black/15 bg-white shadow-lg sm:inset-x-auto sm:w-72 dark:border-white/15 dark:bg-neutral-900"
        >
          {shown.map((s, i) => (
            <li
              key={s.code}
              id={`airport-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              className={`min-h-11 cursor-pointer px-3 py-2.5 text-sm ${
                i === active ? "bg-black/5 dark:bg-white/10" : ""
              }`}
            >
              <span className="font-medium">{s.code}</span>
              <span className="opacity-70"> · {s.city || s.name}</span>
              {s.country && <span className="opacity-45"> · {s.country}</span>}
            </li>
          ))}
        </ul>
      )}
      {showEmpty && (
        <div
          id="airport-suggestions"
          role="status"
          className="absolute inset-x-0 z-20 mt-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm text-muted-foreground shadow-lg sm:inset-x-auto sm:w-72 dark:border-white/15 dark:bg-neutral-900"
        >
          No airports match “{query.trim()}” — try a city or 3-letter code.
        </div>
      )}
    </div>
  );
}
