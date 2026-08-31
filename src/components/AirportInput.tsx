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
}: {
  value: string;
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
  function submitTyped() {
    setOpen(false);
    const raw = query.trim();
    if (!raw) return;
    const upper = raw.toUpperCase();
    if (upper === lastSearched.current) return;
    const exact = suggestions.find((s) => s.code.toUpperCase() === upper);
    if (exact) return fire(exact.code);
    if (/^[A-Z]{3}$/.test(upper)) return fire(upper);
    if (shown.length > 0) return fire(shown[0].code);
    // Unresolvable — keep the field open with the no-results hint, don't search.
    setOpen(true);
  }

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
        <TakeoffIcon className="mr-0.5 h-4 w-4 shrink-0 text-black/35 dark:text-white/50" />
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
                className="flex h-5 w-5 items-center justify-center rounded-full text-base leading-none text-black/35 transition hover:bg-black/10 hover:text-black dark:text-white/40 dark:hover:bg-white/15 dark:hover:text-white"
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
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => (suggestions.length > 0 || noResults) && setOpen(true)}
        onBlur={() =>
          setTimeout(() => {
            setOpen(false);
            submitTyped();
          }, 150)
        }
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
              submitTyped();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
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
        className="min-w-[10ch] flex-1 bg-transparent px-1.5 py-1 text-[15px] outline-none placeholder:text-black/40 disabled:cursor-not-allowed dark:placeholder:text-white/40"
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
          className="absolute inset-x-0 z-20 mt-1 rounded-lg border border-black/15 bg-white px-3 py-2.5 text-sm text-black/60 shadow-lg sm:inset-x-auto sm:w-72 dark:border-white/15 dark:bg-neutral-900 dark:text-white/60"
        >
          No airports match “{query.trim()}” — try a city or 3-letter code.
        </div>
      )}
    </div>
  );
}
