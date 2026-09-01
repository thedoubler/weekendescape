"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Deal } from "@/lib/deals";

const HEIGHT = 280;

// MapLibre is ~230 KB gzipped plus a worker, and `/` is prerendered static with
// the deal list as its LCP. So the map is code-split behind next/dynamic and
// costs nothing until someone presses the toggle. ssr:false because MapLibre
// needs a real DOM (and this file is a Client Component, which that requires).
const DealsMapGL = dynamic(() => import("@/components/DealsMapGL"), {
  ssr: false,
  loading: () => (
    // Same height as the real map, so the list never jumps when tiles arrive.
    <div
      style={{ height: HEIGHT }}
      className="animate-pulse rounded-2xl border border-black/10 bg-black/[0.04] dark:border-white/10 dark:bg-white/[0.04]"
    />
  ),
});

interface View {
  center: [number, number];
  zoom: number;
}

export function DealsMap(props: {
  deals: Deal[];
  origins: { code: string; coords: [number, number] | null }[];
  onSelect?: (flyTo: string) => void;
  highlight?: string | null;
  controls?: React.ReactNode;
}) {
  const [fullscreen, setFullscreen] = useState(false);
  // The map may only mount once the dialog is actually open. Child effects run
  // before this component's showModal() effect, so a map rendered on the same
  // pass as `fullscreen` is constructed inside a display:none dialog — no
  // layout box, so MapLibre falls back to its 400×300 default canvas. Its
  // ResizeObserver never repairs this: MapLibre ignores the observer's initial
  // fire, and for an element born without a box that initial fire IS the
  // dialog opening. Observed as fullscreen painting a small map in the
  // top-left of an otherwise empty dialog. Gating the mount on this flag,
  // which is set after showModal(), means the map always measures a real,
  // full-viewport container.
  const [dialogShown, setDialogShown] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  // The camera survives the move between inline and dialog. A ref, not state:
  // this is written on every gesture end and must not re-render the board.
  const view = useRef<View | null>(null);
  const onViewChange = useCallback((v: View) => {
    view.current = v;
  }, []);

  const close = useCallback(() => setFullscreen(false), []);

  // A native <dialog> gives the focus trap, Escape handling, an inert
  // background and top-layer stacking for free — the last one matters here
  // because a plain portal would fight the list's sticky month dividers and the
  // fixed "back to controls" pill.
  useEffect(() => {
    const el = dialog.current;
    if (!el) return;
    if (fullscreen && !el.open) {
      el.showModal();
      // Android Back should close the map, not leave the site. Same URL, state
      // marker only, so the board's own replaceState sync never races with it.
      history.pushState({ ...history.state, mapFullscreen: true }, "");
      // Lock the page without the position:fixed trick, which loses the list's
      // scroll position on iOS. overflow:hidden preserves scrollTop.
      document.documentElement.style.overflow = "hidden";
      // eslint-disable-next-line react-hooks/set-state-in-effect -- must not
      // flip before showModal(); see the declaration comment.
      setDialogShown(true);
    } else if (!fullscreen && el.open) {
      el.close();
      document.documentElement.style.overflow = "";
      setDialogShown(false);
    }
  }, [fullscreen]);

  useEffect(() => {
    if (!fullscreen) return;
    const onPop = () => setFullscreen(false);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [fullscreen]);

  useEffect(() => {
    return () => {
      document.documentElement.style.overflow = "";
    };
  }, []);

  // A getter, so the ref is read inside the child's mount effect rather than
  // during this component's render.
  const getView = useCallback(() => view.current, []);
  const shared = { ...props, getView, onViewChange };

  return (
    <>
      {!fullscreen && (
        <DealsMapGL
          {...shared}
          onToggleFullscreen={() => setFullscreen(true)}
        />
      )}
      <dialog
        ref={dialog}
        aria-label="Map of results"
        // Escape fires `cancel`; route both paths through the same close so the
        // pushed history entry is always unwound exactly once.
        onCancel={(e) => {
          e.preventDefault();
          history.back();
        }}
        onClose={close}
        className="h-full max-h-none w-full max-w-none bg-white p-0 backdrop:bg-black/50 dark:bg-neutral-950"
      >
        {fullscreen && dialogShown && (
          <div className="flex h-full flex-col p-3">
            <DealsMapGL
              {...shared}
              fullscreen
              onToggleFullscreen={() => history.back()}
            />
          </div>
        )}
      </dialog>
    </>
  );
}
