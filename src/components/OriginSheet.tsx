"use client";

import { useEffect, useRef } from "react";
import { AirportInput } from "@/components/AirportInput";
import { MAX_ORIGINS, addOrigin, removeOrigin } from "@/lib/origins";

// The one control that could not become a facet. Weekend length, stops and
// adults are each a short list of values, so they fit in a popover; the origin
// needs a text field, autocomplete, up to three chips and a location prompt —
// that is a form, and a form does not belong in a line of prose.
//
// A real <dialog>, not a div with a high z-index: it gives the focus trap,
// Escape, inertness of the page behind and top-layer stacking for free, all of
// which a hand-rolled sheet gets wrong. (:root carries `color-scheme: light
// dark` in globals.css — without it the UA paints the dialog's own defaults in
// light colours on a dark page.)

interface Props {
  open: boolean;
  origins: string[];
  onChange: (next: string[]) => void;
  onDetect: () => void;
  /** Dismissal is the commit — the parent decides whether anything changed. */
  onClose: () => void;
}

export function OriginSheet({ open, origins, onChange, onDetect, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // jsdom implements <dialog> but not showModal/close, so the fallback is
      // not defensive padding — it is what makes this component testable.
      if (typeof d.showModal === "function") d.showModal();
      else d.open = true;
      // Someone who opened this came to type an airport.
      inputRef.current?.focus();
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.open = false;
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      // `close` fires for every route out — Escape, the backdrop, the button —
      // so the commit hangs off it rather than off each of them.
      onClose={onClose}
      onClick={(e) => {
        // The backdrop is the dialog element itself; anything inside is a child.
        if (e.target === ref.current) ref.current?.close();
      }}
      className="m-0 mt-auto w-full max-w-none rounded-t-2xl border-t border-black/10 bg-white p-0 text-black backdrop:bg-black/45 sm:mx-auto sm:mt-auto sm:mb-6 sm:max-w-md sm:rounded-2xl sm:border dark:border-white/15 dark:bg-[#1b1e26] dark:text-white"
    >
      <div className="flex flex-col gap-3.5 p-4">
        <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-black/10 dark:bg-white/15" />
        <div>
          <h2 className="text-base font-semibold tracking-tight">Flying from</h2>
          <p className="mt-0.5 text-[12.5px] text-black/55 dark:text-white/55">
            Up to {MAX_ORIGINS} airports. Closing this reloads the board.
          </p>
        </div>

        <AirportInput
          value=""
          chips={origins}
          onRemoveChip={(code) => onChange(removeOrigin(origins, code))}
          onSearch={(code) => onChange(addOrigin(origins, code))}
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

        <button
          type="button"
          onClick={onDetect}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-black/10 px-3.5 py-2 text-xs font-medium text-black/70 transition hover:bg-black/[0.04] hover:text-black dark:border-white/15 dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <span aria-hidden>📍</span>
          Find my airport
        </button>

        <div className="flex items-center justify-end border-t border-black/[0.07] pt-3 dark:border-white/10">
          <button
            type="button"
            disabled={origins.length === 0}
            onClick={() => ref.current?.close()}
            className="inline-flex h-10 items-center rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40 dark:bg-white dark:text-black"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
