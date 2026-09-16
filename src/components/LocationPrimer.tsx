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
          className="h-20 w-20"
          fill="none"
        >
          <circle cx="48" cy="48" r="18" className="stroke-black/15 dark:stroke-white/20" strokeWidth="1.5" />
          <circle cx="48" cy="48" r="30" className="stroke-black/10 dark:stroke-white/15" strokeWidth="1.5" />
          <circle cx="48" cy="48" r="42" className="stroke-black/[0.07] dark:stroke-white/10" strokeWidth="1.5" />
          <circle
            cx="48"
            cy="48"
            r="30"
            stroke="#f97316"
            strokeWidth="1.5"
            strokeDasharray="10 178"
            strokeLinecap="round"
            className="motion-safe:animate-spin"
            style={{ transformOrigin: "48px 48px", animationDuration: "6s" }}
          />
          {/* The pin — you. */}
          <path
            d="M48 34c-6.6 0-12 5.4-12 12 0 8.4 12 20 12 20s12-11.6 12-20c0-6.6-5.4-12-12-12Z"
            fill="#f97316"
          />
          <circle cx="48" cy="46" r="4.5" fill="white" />
          {/* The plane on the outer ring — where you could be. */}
          <g transform="translate(80 22) rotate(40)">
            <path
              d="M9 0 L2.5 -2.3 L-6.5 -1 L-8 -2.7 L-10 -2.3 L-8.6 0 L-10 2.3 L-8 2.7 L-6.5 1 L2.5 2.3 Z"
              className="fill-black/70 dark:fill-white/80"
            />
          </g>
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
