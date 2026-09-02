"use client";

import { useEffect, useRef, useState } from "react";
import { AboutContent } from "@/components/AboutContent";
import { SITE_NAME } from "@/lib/site";

// The footer's one navigable thing, opened in place.
//
// It stays a REAL <a href="/about">. That is not belt-and-braces: /about is the
// only page on this client-rendered site a crawler can read in full, and it is
// what the affiliate programmes and the geolocation prompt make a fair thing to
// ask for. So the link is the truth and the dialog is the enhancement —
// cmd-click, middle-click, "open in new tab" and a JS-less visitor all still
// get the page, because the handler bows out for every one of those.
//
// A real <dialog>, like OriginSheet and CalendarDialog: Escape, focus
// containment, inertness behind, and top-layer stacking come free, and the
// html:has(dialog[open]) rule in globals.css already stops the board scrolling
// underneath.
export function AboutDialog({ className }: { className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.open = true;
    } else if (!open && d.open) {
      if (typeof d.close === "function") d.close();
      else d.open = false;
    }
  }, [open]);

  return (
    <>
      <a
        href="/about"
        className={className}
        onClick={(e) => {
          // Every route that means "somewhere else, please" is left alone.
          if (
            e.metaKey ||
            e.ctrlKey ||
            e.shiftKey ||
            e.altKey ||
            e.button !== 0
          )
            return;
          e.preventDefault();
          setOpen(true);
        }}
      >
        About, privacy &amp; contact
      </a>

      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          // The backdrop is the dialog element itself; anything inside is a child.
          if (e.target === ref.current) ref.current?.close();
        }}
        aria-labelledby="about-dialog-title"
        // Full screen on a phone, a centred sheet from `sm` up — the same shape
        // OriginSheet uses, for the same reason: this is a page's worth of text,
        // and a bottom sheet would give it a third of the screen to live in.
        // Desktop-first with max-sm: overrides, because mobile-first put h-dvh in
        // the base layer and sm:h-auto could not reliably take it back.
        className="m-auto max-h-[86vh] w-[min(42rem,calc(100vw-2rem))] max-w-none overflow-hidden rounded-2xl border border-black/10 bg-white p-0 text-black backdrop:bg-black/45 max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:rounded-none max-sm:border-0 dark:border-white/15 dark:bg-[#1b1e26] dark:text-white"
      >
        <div className="flex max-h-[86vh] flex-col max-sm:h-dvh max-sm:max-h-none">
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-black/[0.07] px-5 py-4 dark:border-white/10">
            <h2
              id="about-dialog-title"
              className="text-base font-semibold tracking-tight"
            >
              About {SITE_NAME}
            </h2>
            {/* -m-2 p-2 keeps the visual size while giving it a 44px tap target. */}
            <button
              type="button"
              onClick={() => ref.current?.close()}
              aria-label="Close"
              className="-m-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl leading-none text-muted-foreground transition hover:bg-black/5 hover:text-black dark:hover:bg-white/10 dark:hover:text-white"
            >
              <span aria-hidden>✕</span>
            </button>
          </div>
          {/* overscroll-contain: a trackpad fling that runs out of dialog should
              die here rather than rubber-banding the page behind it. */}
          <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto overscroll-contain px-5 py-5 text-left">
            <AboutContent />
          </div>
        </div>
      </dialog>
    </>
  );
}
