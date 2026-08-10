"use client";

import { useEffect, useState } from "react";

// Finds whatever is wider than the viewport, on the device that actually has
// the problem. Add `?debug=overflow` to any URL.
//
// This exists because horizontal-scroll bugs are almost impossible to chase
// from a desktop: `body { overflow-x: hidden }` (layout.tsx) silences the
// symptom everywhere, media queries mean a narrowed desktop window is NOT the
// mobile layout, and this project's automation browser cannot emulate a phone
// viewport at all. So the check has to run where the bug is.
//
// Costs nothing when the flag is absent: it returns null before doing any work.

interface Offender {
  label: string;
  overRight: number;
  overLeft: number;
  width: number;
}

function describe(el: Element): string {
  const cls = (el.getAttribute("class") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(".");
  const id = el.id ? `#${el.id}` : "";
  return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ""}`;
}

export default function OverflowDebug() {
  const [on, setOn] = useState(false);
  const [rows, setRows] = useState<Offender[]>([]);
  const [doc, setDoc] = useState({ scroll: 0, client: 0 });

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("debug") !== "overflow")
      return;
    setOn(true);

    const scan = () => {
      const de = document.documentElement;
      const limit = de.clientWidth;
      setDoc({ scroll: de.scrollWidth, client: limit });

      const found: Offender[] = [];
      for (const el of Array.from(document.body.querySelectorAll("*"))) {
        if (el.closest("[data-overflow-debug]")) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        // Ignore anything deliberately scrollable in its own right.
        const style = getComputedStyle(el);
        if (style.overflowX === "auto" || style.overflowX === "scroll") continue;
        const overRight = Math.round(r.right - limit);
        const overLeft = Math.round(-r.left);
        if (overRight > 1 || overLeft > 1) {
          found.push({
            label: describe(el),
            overRight: Math.max(0, overRight),
            overLeft: Math.max(0, overLeft),
            width: Math.round(r.width),
          });
          (el as HTMLElement).style.outline = "2px solid #e11d48";
        }
      }
      // Widest offender first — the outermost culprit is usually the cause and
      // the rest are its children inheriting the problem.
      found.sort((a, b) => b.overRight + b.overLeft - (a.overRight + a.overLeft));
      setRows(found.slice(0, 8));
    };

    // Let the board finish rendering; re-scan on rotate/resize.
    const t = setTimeout(scan, 1200);
    window.addEventListener("resize", scan);
    window.addEventListener("orientationchange", scan);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", scan);
      window.removeEventListener("orientationchange", scan);
    };
  }, []);

  if (!on) return null;

  const scrolls = doc.scroll > doc.client;
  return (
    <div
      data-overflow-debug
      className="fixed inset-x-0 bottom-0 z-[9999] max-h-[45vh] overflow-y-auto border-t-2 border-rose-500 bg-black/90 p-3 font-mono text-[11px] leading-relaxed text-white"
    >
      <div className="mb-1 font-bold">
        viewport {doc.client}px · document {doc.scroll}px{" "}
        {scrolls ? `· OVERFLOWS by ${doc.scroll - doc.client}px` : "· no overflow"}
      </div>
      {rows.length === 0 ? (
        <div>
          Nothing extends past the viewport. If it still scrolls sideways, the
          cause is the page zoom level or an element in the top layer (an open
          dialog), not the flow.
        </div>
      ) : (
        <ul className="flex flex-col gap-1">
          {rows.map((r, i) => (
            <li key={i}>
              <span className="text-rose-400">
                {r.overRight > 0 ? `+${r.overRight}px right` : ""}
                {r.overLeft > 0 ? ` +${r.overLeft}px left` : ""}
              </span>{" "}
              <span className="text-white/60">({r.width}px wide)</span>
              <div className="break-all text-white/90">{r.label}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
