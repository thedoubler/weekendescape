"use client";

import { useEffect, useRef, useState } from "react";

// GetYourGuide activity widget, scoped to the destination city.
//
// Three deliberate constraints, because this is a third-party script on a page
// whose whole value is loading fast:
//
//  1. It only ever mounts inside an EXPANDED card. The board can show 60+ deals;
//     mounting one widget per card would mean 60 iframes and 60 network trees
//     for a page nobody has said they're interested in yet.
//  2. The script is fetched once per session, on the first expand, and shared.
//     Rendering is per-container after that.
//  3. If nothing renders, the whole section — heading included — is removed.
//     A "Things to do" header over an empty box reads as broken, and GYG has no
//     inventory in plenty of the smaller cities this board surfaces.
//
// The partner ID is public by design (it rides in the widget markup on every
// GYG affiliate site), so it is not a secret; the env var exists so the widget
// can be turned off entirely without a code change.
const PARTNER_ID = process.env.NEXT_PUBLIC_GYG_PARTNER_ID ?? "4YMGCHI";
const SCRIPT_SRC =
  "https://widget.getyourguide.com/dist/pa.umd.production.min.js";

// How long to wait before deciding the widget rendered nothing. The script has
// to load, then call out for inventory; 6s is past the slow case without
// leaving a dead heading on screen indefinitely.
const EMPTY_TIMEOUT_MS = 6000;

// No horizontal carousel. It was tried: forcing the frame onto a 1400px canvas
// and scrolling the canvas. The frame did collapse from 1421px tall to 150px,
// which looked like a row in the measurements — but it was the widget failing
// to lay out at all, and it rendered BLANK for every city, Milan included.
// The lesson is in the method, not the CSS: that was measured and never
// looked at.
//
// GYG's activities widget is a vertical list and sizes itself to its
// container. Three items is what fits a card without burying the Book button.
const ITEMS = 3;

let scriptPromise: Promise<void> | null = null;

function loadWidgetScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${SCRIPT_SRC}"]`
    );
    if (existing) {
      resolve();
      return;
    }
    const el = document.createElement("script");
    el.src = SCRIPT_SRC;
    el.async = true;
    el.defer = true;
    el.addEventListener("load", () => resolve());
    el.addEventListener("error", () => reject(new Error("gyg script failed")));
    document.head.appendChild(el);
  });
  // A failed load must not poison the cache for the rest of the session — the
  // next expand should be allowed to retry.
  scriptPromise.catch(() => {
    scriptPromise = null;
  });
  return scriptPromise;
}

export default function ThingsToDo({ city }: { city: string }) {
  // Widget turned off, or nothing to key it on: no row, no click, no promise
  // we can't keep.
  if (!PARTNER_ID || !city) return null;
  return <ThingsToDoWidget city={city} />;
}

function ThingsToDoWidget({ city }: { city: string }) {
  const holder = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Has the widget ever been opened? One-way. Collapsing hides the frame rather
  // than unmounting it, so reopening is instant and costs no second request.
  const [mounted, setMounted] = useState(false);
  // "pending" until we know whether anything rendered, so nothing flashes in
  // and back out.
  const [state, setState] = useState<"pending" | "shown" | "empty">("pending");

  useEffect(() => {
    if (!mounted) return;
    const node = holder.current;
    if (!node) return;

    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // NOTE: there is no way to tell an empty widget from a full one.
    // Measured on a live board: GYG posts `{"height": 0}` once a second for
    // BOTH Memmingen (no inventory) and Milan (plenty), and the iframe renders
    // 150px tall either way. The contents are cross-origin, so nothing outside
    // can read them. An earlier version of this file claimed to detect empties
    // via `height`; it did not, and it hid Milan.
    //
    // So the section always renders once opened. That is the honest behaviour:
    // better a widget that occasionally shows little than a heading that
    // silently deletes real results.
    const observer = new MutationObserver(() => {
      if (alive && node.childElementCount > 0) setState("shown");
    });
    observer.observe(node, { childList: true, subtree: true });

    loadWidgetScript()
      .then(() => {
        if (!alive) return;
        // Only catches the case where the script loaded but never rendered a
        // frame at all (blocked by an ad blocker, say).
        timer = setTimeout(() => {
          if (alive && node.childElementCount === 0) setState("empty");
        }, EMPTY_TIMEOUT_MS);
      })
      .catch(() => {
        if (alive) setState("empty");
      });

    return () => {
      alive = false;
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [city, mounted]);

  const panelId = `things-to-do-${city.replace(/\W+/g, "-").toLowerCase()}`;

  if (state === "empty") {
    return (
      <p className="border-t border-black/10 pt-3 text-sm text-muted dark:border-white/10">
        No activities listed for {city}.
      </p>
    );
  }

  const label = `Things to do in ${city}`;

  return (
    <section className="border-t border-black/10 pt-3 dark:border-white/10">
      {/* A real toggle, not a one-way door. It used to open and stay open,
          which left the panel permanently taller for anyone who looked once. */}
      <button
        type="button"
        onClick={() => {
          setMounted(true);
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-11 w-full items-center justify-between gap-2 text-left text-sm text-black/70 transition hover:text-black dark:text-white/70 dark:hover:text-white"
      >
        <span>{open && state === "pending" ? "Loading…" : label}</span>
        <span
          aria-hidden
          className="text-base leading-none text-muted"
        >
          {open ? "−" : "+"}
        </span>
      </button>
      <div id={panelId} hidden={!open}>
        {mounted && (
          <div
            ref={holder}
            className="mt-2"
            data-gyg-widget="activities"
            data-gyg-number-of-items={String(ITEMS)}
            data-gyg-partner-id={PARTNER_ID}
            data-gyg-locale-code="en-US"
            data-gyg-q={city}
            data-gyg-href="https://widget.getyourguide.com/default/activities.frame"
          />
        )}
      </div>
    </section>
  );
}
