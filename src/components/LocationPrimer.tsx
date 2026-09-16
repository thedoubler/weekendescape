"use client";

import { useEffect, useRef } from "react";

// The soft-ask, made visible: a small branded primer that appears between
// the "Find my airport" tap and the browser's native location prompt — but
// ONLY when the permission is still undecided. Granted skips it (silent
// magic), denied skips it (the notice explains), so nobody who has already
// answered is ever asked twice. The native prompt fires from the Allow
// button's own click, keeping the user-gesture chain intact.
//
// Copy discipline: a browser permission is a one-shot resource (a denial is
// near-permanent), so this screen exists to make the real prompt a decision
// rather than a reflex — and to be skimmable in two seconds: one headline,
// one sentence, two buttons. No paragraph earns its place here.
export function LocationPrimer({
  open,
  onAllow,
  onDismiss,
}: {
  open: boolean;
  /** Fires the real geolocation request (native prompt) from this gesture. */
  onAllow: () => void;
  onDismiss: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      document.documentElement.style.overflow = "hidden";
    } else if (!open && el.open) {
      el.close();
      document.documentElement.style.overflow = "";
    }
  }, [open]);
  useEffect(() => {
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby="loc-primer-title"
      onCancel={(e) => {
        e.preventDefault();
        onDismiss();
      }}
      onClose={() => open && onDismiss()}
      className="m-auto w-[min(92vw,340px)] rounded-2xl border border-black/10 bg-white p-6 text-black shadow-2xl backdrop:bg-black/50 dark:border-white/15 dark:bg-neutral-900 dark:text-white"
    >
      <div className="flex flex-col items-center gap-4 text-center">
        {/* The graphic: a radar of rings with the pin at home and a plane on
            the outer ring — "we look around you". Pure currentColor +
            brand orange, so it belongs to the site rather than to a stock
            library. The pulse is decoration and sits out for reduced motion. */}
        <svg
          aria-hidden
          viewBox="0 0 96 96"
          className="h-24 w-24"
          fill="none"
        >
          {/* The story in one picture: a pulse leaves your pin and the
              airports around you light up. (A plane glyph was tried on the
              ring and read as a rocket at this size — owner's report — so
              the cast is rings, dots, pin, pulse.) */}
          <circle cx="48" cy="48" r="20" className="stroke-black/[0.13] dark:stroke-white/[0.18]" strokeWidth="1.5" />
          <circle cx="48" cy="48" r="34" className="stroke-black/[0.08] dark:stroke-white/[0.12]" strokeWidth="1.5" />
          {/* The pulse — searching. Tailwind's ping, anchored to the pin. */}
          <circle
            cx="48"
            cy="48"
            r="15"
            stroke="#f97316"
            strokeWidth="2"
            className="motion-safe:animate-ping"
            style={{ transformOrigin: "48px 48px", animationDuration: "2.2s" }}
          />
          {/* Airports around you: quiet dots on the rings, and the nearest
              one already lit — the promise, not just the search. */}
          <circle cx="68.5" cy="41.5" r="4.2" fill="#f97316" />
          <circle cx="68.5" cy="41.5" r="1.7" fill="white" />
          <circle cx="31" cy="33" r="2.6" className="fill-black/25 dark:fill-white/30" />
          <circle cx="59" cy="70.5" r="2.6" className="fill-black/25 dark:fill-white/30" />
          <circle cx="21.5" cy="59" r="2.2" className="fill-black/20 dark:fill-white/25" />
          {/* The pin — you. Grounded by its own soft shadow. */}
          <ellipse cx="48" cy="67.5" rx="7.5" ry="2.2" className="fill-black/[0.10] dark:fill-white/[0.12]" />
          <path
            d="M48 32c-7 0-12.7 5.7-12.7 12.7 0 8.9 12.7 21.3 12.7 21.3s12.7-12.4 12.7-21.3C60.7 37.7 55 32 48 32Z"
            fill="#f97316"
          />
          <circle cx="48" cy="44.7" r="4.8" fill="white" />
        </svg>

        <h2 id="loc-primer-title" className="text-lg font-bold tracking-tight text-balance">
          Find your nearest airport
        </h2>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Used once, only to pick your home airport.
          Never stored, never shared.
        </p>

        <div className="mt-1 flex w-full flex-col gap-2">
          <button
            type="button"
            onClick={onAllow}
            className="h-11 w-full rounded-full bg-black text-sm font-semibold text-white transition hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90"
          >
            Use my location
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="h-11 w-full rounded-full text-sm font-medium text-muted-foreground transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
          >
            Not now
          </button>
        </div>
      </div>
    </dialog>
  );
}
