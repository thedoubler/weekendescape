"use client";

import { useEffect, useState } from "react";

// Steps a short word in place, then stops.
//
// Three deliberate choices:
//
// 1. It ENDS. An infinite loop in a persistent header is a permanent
//    attention magnet in the periphery of someone scanning prices — you can't
//    habituate to motion, only be irritated by it. Two transitions establish
//    "there are many kinds of us"; after that the point is made and the header
//    goes still for the rest of the session.
// 2. It ROLLS rather than cross-fades. A fade empties the slot at its midpoint,
//    which reads as a rendering glitch; an overlapping roll is never empty and
//    has a direction, which is what "stepping through a list" should look like.
// 3. Variety lives ACROSS visits, not within one: the follow-up words are
//    picked per mount, so a returning visitor sees different ones.
const STEPS = 2;
const HOLD_MS = 1900;
const OUT_MS = 160;
const IN_MS = 260;
// The incoming word starts before the outgoing one has finished leaving.
const OVERLAP_MS = 120;

export function RotatingWord({
  words,
  className = "",
}: {
  words: string[];
  className?: string;
}) {
  // Always the first word on the server and on first paint, so there's no
  // hydration mismatch and no flash of a different word.
  const [word, setWord] = useState(words[0]);
  const [phase, setPhase] = useState<"in" | "out">("in");

  useEffect(() => {
    if (words.length < 2) return;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const timers: ReturnType<typeof setTimeout>[] = [];

    const run = () => {
      // Clear anything queued, so toggling the OS setting mid-session actually
      // stops it rather than leaving a timer alive.
      timers.forEach(clearTimeout);
      timers.length = 0;
      if (media?.matches) {
        setWord(words[0]);
        setPhase("in");
        return;
      }
      // A fresh pick per mount — the pool is the variety, not the loop.
      const rest = words.slice(1);
      for (let i = rest.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [rest[i], rest[j]] = [rest[j], rest[i]];
      }
      const queue = rest.slice(0, STEPS);
      queue.forEach((next, step) => {
        const at = HOLD_MS + step * (HOLD_MS + OUT_MS + IN_MS);
        timers.push(setTimeout(() => setPhase("out"), at));
        timers.push(
          setTimeout(() => {
            setWord(next);
            setPhase("in");
          }, at + OVERLAP_MS)
        );
      });
    };

    run();
    media?.addEventListener?.("change", run);
    return () => {
      timers.forEach(clearTimeout);
      media?.removeEventListener?.("change", run);
    };
  }, [words]);

  return (
    // A fixed band with overflow hidden: the roll can never grow the header, so
    // the CLS budget here is zero. The parent sets `nowrap`, which is the actual
    // guard against the line reflowing.
    <span
      className={`inline-block overflow-hidden align-bottom ${className}`}
      // rem, NOT em: the parent is `text-sm`, whose line-height is 1.25rem
      // (20px) while 1.25em resolves against the 14px font-size (17.5px). With
      // `align-bottom` that 2.5px gap dropped the word below the baseline.
      style={{ height: "1.25rem" }}
    >
      <span
        key={word}
        className="block"
        style={{
          animation: `${phase === "out" ? "wordOut" : "wordIn"} ${
            phase === "out" ? OUT_MS : IN_MS
          }ms both`,
          animationTimingFunction:
            phase === "out"
              ? "cubic-bezier(.55, 0, 1, .45)"
              : "cubic-bezier(.22, 1, .36, 1)",
        }}
      >
        {word}
      </span>
    </span>
  );
}
