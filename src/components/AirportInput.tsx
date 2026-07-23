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

export function AirportInput({
  value,
  onSearch,
  inputRef,
}: {
  value: string;
  onSearch: (code: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const lastSearched = useRef(value);

  // Reflect external changes (geolocation, saved home).
  useEffect(() => {
    setQuery(value);
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
    if (memo) {
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

  function fire(code: string) {
    const c = code.trim().toUpperCase();
    setQuery(c);
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
      <input
        ref={inputRef}
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
          }
        }}
        placeholder="Airport or city, e.g. Barcelona"
        className="w-full rounded-lg border border-black/10 bg-black/[0.02] px-3.5 py-2.5 text-[15px] outline-none transition focus-visible:ring-2 focus-visible:ring-orange-400/60 focus:border-black/25 focus:bg-transparent dark:border-white/15 dark:bg-white/[0.03] dark:focus:border-white/35"
      />
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
