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
  /** Location detection in flight — the button says so and stops re-arming. */
  detecting?: boolean;
  /** Why the sheet is asking (geolocation denied / not found). One line,
   *  under the detect button it answers. */
  notice?: string | null;
  /** Meet-up: everyone flies to the same place, the same weekend. Only
   *  offered once a second airport exists — with one it has no meaning. */
  meetUp?: boolean;
  onMeetUpChange?: (v: boolean) => void;
  /** Dismissal is the commit — the parent decides whether anything changed. */
  onClose: () => void;
}

export function OriginSheet({
  open,
  origins,
  onChange,
  onDetect,
  detecting = false,
  notice = null,
  meetUp = false,
  onMeetUpChange,
  onClose,
}: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Resolves text still sitting in the field. Only the explicit ways out call
  // it: Done means "use what I typed", while Escape and the backdrop mean the
  // opposite and must not turn a half-typed word into an airport.
  const flushInput = useRef<(() => void) | null>(null);

  function done() {
    flushInput.current?.();
    ref.current?.close();
  }

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      // jsdom implements <dialog> but not showModal/close, so the fallback is
      // not defensive padding — it is what makes this component testable.
      if (typeof d.showModal === "function") d.showModal();
      else d.open = true;
      // Focus is handled by `autoFocus` on the input itself, not from here. A
      // modal <dialog> focuses its first focusable child, which is the ✕ that
      // REMOVES an airport chip — so opening the sheet armed the button that
      // deletes the airport you already have. Calling .focus() after
      // showModal() does not win, nor does deferring it a frame; the attribute
      // does, because the dialog consults it while choosing.
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
      // FULL SCREEN on a phone, centred modal from `sm` up.
      //
      // It was a bottom sheet on mobile, sized to its content. Choosing an
      // airport is a search-and-pick task: the field wants the keyboard, the
      // suggestion list wants room, and a sheet that owns only the lower third
      // of the screen gives the list nowhere to go once the keyboard is up.
      // Google's mobile flight search takes the whole screen for exactly this
      // step, which is the reference this follows.
      //
      // `h-dvh`, not `h-screen`: on mobile Safari `100vh` is the viewport with
      // the browser chrome hidden, so a full-height dialog is taller than what
      // you can actually see and the footer sits below the fold.
      //
      // CENTRED from `sm` up: `mt-auto` pinned it to the bottom of the desktop
      // window too, which put a 278px dialog 421px down a 723px viewport with
      // 24px under it — it read as something sliding off the screen rather than
      // as a modal. `sm:m-auto` restores the UA's own centring.
      // Written DESKTOP-FIRST with max-sm: overrides, not mobile-first with sm:
      // ones. Mobile-first put `h-dvh` in the base layer and `sm:h-auto` could
      // not reliably take it back — the desktop dialog came out 690px tall with
      // a field at the top and empty space under it. Scoping every full-screen
      // rule to max-sm means the desktop dialog is simply never told to be tall.
      className="m-auto max-w-md rounded-2xl border border-black/10 bg-white p-0 text-black backdrop:bg-black/45 max-sm:m-0 max-sm:h-dvh max-sm:w-full max-sm:max-w-none max-sm:rounded-none max-sm:border-0 dark:border-white/15 dark:bg-[#1b1e26] dark:text-white"
    >
      {/* h-full + flex-col so the footer can sit at the bottom of a full-screen
          phone dialog while the middle scrolls. On desktop the dialog is
          content-sized again, so this collapses to nothing. */}
      <div className="flex flex-col gap-3.5 p-4 max-sm:h-full max-sm:overflow-y-auto">
        {/* The drag handle is a bottom-sheet affordance and would be a lie on a
            full-screen dialog, so below `sm` the way out is a real labelled
            button instead. Escape and the backdrop still work everywhere. */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight">Flying from</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Up to {MAX_ORIGINS} airports. Closing this reloads the board.
            </p>
          </div>
          {/* -m-2 p-2 keeps the visual size while giving it a 44px tap target. */}
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="-m-2 shrink-0 rounded-full p-2 text-xl leading-none text-muted-foreground transition hover:bg-black/5 hover:text-black sm:hidden dark:hover:bg-white/10 dark:hover:text-white"
          >
            <span aria-hidden>✕</span>
          </button>
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
          flushRef={flushInput}
          autoFocus
        />

        <button
          type="button"
          onClick={onDetect}
          disabled={detecting}
          className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-black/10 px-3.5 py-2 text-xs font-medium text-black/70 transition hover:bg-black/[0.04] hover:text-black disabled:opacity-60 dark:border-white/15 dark:text-white/70 dark:hover:bg-white/[0.06] dark:hover:text-white"
        >
          <span aria-hidden>📍</span>
          {detecting ? "Finding your airport…" : "Find my airport"}
        </button>

        {/* Meet-up belongs here, not in the receipt: it is a statement about
            the airports above it ("these are two PEOPLE, not one person with
            two options"), and it only appears once a second airport gives it
            meaning. A native checkbox — this is a setting, not a search. */}
        {origins.length >= 2 && onMeetUpChange && (
          <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-black/10 p-3 dark:border-white/15">
            <input
              type="checkbox"
              checked={meetUp}
              onChange={(e) => onMeetUpChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-orange-600 dark:accent-orange-400"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">Meet up</span>
              <span className="text-[12.5px] leading-snug text-muted-foreground">
                Fly from different cities to the same place, the same weekend.
                The board shows only places everyone can reach, priced as one
                fare each.
              </span>
            </span>
          </label>
        )}

        {/* The answer to a failed detection, where the eye already is: under
            the button that failed. role="status" so a screen reader hears it
            without focus moving; amber because it explains, it doesn't scold. */}
        {notice && (
          <p
            role="status"
            className="text-[12.5px] leading-snug text-amber-700 dark:text-amber-300/90"
          >
            {notice}
          </p>
        )}

        {/* mt-auto pushes the footer to the bottom of the full-screen phone
            dialog; with a content-sized desktop dialog there is no free space
            for it to take, so it sits directly under the content as before. */}
        <div className="flex items-center justify-end border-t border-black/[0.07] pt-3 max-sm:mt-auto dark:border-white/10">
          <button
            type="button"
            disabled={origins.length === 0}
            onClick={done}
            // h-12 on a phone clears the 44px tap floor; h-10 from `sm` up.
            className="inline-flex h-12 w-full items-center justify-center rounded-full bg-neutral-900 px-6 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-40 sm:h-10 sm:w-auto dark:bg-white dark:text-black"
          >
            Done
          </button>
        </div>
      </div>
    </dialog>
  );
}
