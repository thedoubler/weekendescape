"use client";

import { type RefObject, useEffect, useRef, useState } from "react";

interface Suggestion {
  code: string;
  name: string;
  city: string;
  country: string;
}

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
  const lastSearched = useRef(value);

  // Reflect external changes (geolocation, saved home).
  useEffect(() => {
    setQuery(value);
    lastSearched.current = value;
  }, [value]);

  // Debounced suggestion fetch.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2 || q.toUpperCase() === lastSearched.current) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/airports?term=${encodeURIComponent(q)}`);
        const body = await res.json();
        setSuggestions(Array.isArray(body.airports) ? body.airports : []);
        setActive(-1);
      } catch {
        setSuggestions([]);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [query]);

  function choose(s: Suggestion) {
    setQuery(s.code);
    lastSearched.current = s.code;
    setOpen(false);
    setSuggestions([]);
    onSearch(s.code);
  }

  function submitTyped() {
    const code = query.trim().toUpperCase();
    setOpen(false);
    if (code && code !== lastSearched.current) {
      lastSearched.current = code;
      onSearch(code);
    }
  }

  return (
    <div className="relative w-full">
      <input
        ref={inputRef}
        value={query}
        role="combobox"
        aria-expanded={open && suggestions.length > 0}
        aria-autocomplete="list"
        aria-controls="airport-suggestions"
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
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
            setActive((a) => Math.min(a + 1, suggestions.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            if (open && active >= 0 && suggestions[active]) {
              e.preventDefault();
              choose(suggestions[active]);
            } else {
              submitTyped();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder="Airport or city, e.g. Barcelona"
        className="w-full rounded-lg border border-black/10 bg-black/[0.02] px-3.5 py-2.5 text-[15px] outline-none transition focus:border-black/25 focus:bg-transparent dark:border-white/15 dark:bg-white/[0.03] dark:focus:border-white/35"
      />
      {open && suggestions.length > 0 && (
        <ul
          id="airport-suggestions"
          role="listbox"
          className="absolute inset-x-0 z-20 mt-1 max-h-64 overflow-auto rounded-lg border border-black/15 bg-white shadow-lg sm:inset-x-auto sm:w-72 dark:border-white/15 dark:bg-neutral-900"
        >
          {suggestions.map((s, i) => (
            <li
              key={s.code}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(s);
              }}
              className={`cursor-pointer px-3 py-2 text-sm ${
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
    </div>
  );
}
