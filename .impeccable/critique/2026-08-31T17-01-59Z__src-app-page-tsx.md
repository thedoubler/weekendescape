---
target: the board (src/app/page.tsx)
total_score: 30
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-08-31T17-01-59Z
slug: src-app-page-tsx
---
# Design critique — weekend.flights board (src/app/page.tsx @ localhost:3001)

Method: dual-agent (A: design-director review in live Chrome · B: deterministic detector + browser evidence). Desktop verified at 1280; mobile via same-origin 390px iframe (programmatic window resize silently fails on this machine).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Excellent stamps/skeletons; receipt/URL/board can desync after the Escape bug (P1) |
| 2 | Match System / Real World | 4 | Cities not codes, "2d to explore", receipt-style costs |
| 3 | User Control and Freedom | 2 | Escape commits instead of cancelling, everywhere it matters |
| 4 | Consistency and Standards | 3 | "In 2 weeks" vs "Mid January" mixed; stale calendar caption |
| 5 | Error Prevention | 2 | Blur-commits-top-suggestion converts half-typed text into a committed airport |
| 6 | Recognition Rather Than Recall | 3 | Dead options disabled (good); December silently missing from Calendar |
| 7 | Flexibility and Efficiency | 3 | Shareable URLs, linked map⇄list; no keyboard shortcuts, no "refresh prices" |
| 8 | Aesthetic and Minimalist Design | 4 | Ruthless editing; one accent; conditional-warnings-only |
| 9 | Error Recovery | 3 | Good timeout copy; error state has no retry button |
| 10 | Help and Documentation | 3 | Self-documenting at point of need; the "reloads the board" rule lives in 11px small print |
| **Total** | | **30/40** | Good — two weak heuristics, both tracing to commit-on-dismiss |

## Design Specificity Verdict

PASS — authored, decisively (both assessments independently). Receipt-as-sentence search, day-strip "portion of day usable", weekend-as-one-block calendar, honesty layer (Bergamo caveat, with-bag total) are product-specific structures.

Deterministic scan: 1 CLI finding = false positive (SearchReceipt.tsx:202 dotted underline, not an accent border). In-page 43 findings collapse to: 10px text-black/45 day labels (DayBlocks.tsx:139, ×41; below 11px floor AND 3.36:1 contrast — AA failure), ~141-char footer line at desktop, advisory single-font note. Probes: no horizontal overflow at 1280/390, 0 unlabeled buttons/images, 0 console errors, 1 placeholder-only input (AirportInput.tsx:276).

## Priority Issues

- [P1] Escape/blur commits a half-typed airport and desyncs board (browser-verified). "vien"+Esc committed VIE via AirportInput 150ms blur submitTyped(); closeOriginSheet compared origins before timeout → receipt "Cluj-Napoca + VIE", URL from=CLJ, CLJ-only data. Fix: Esc closes list only; never submitTyped on blur while dialog closing; commit on Enter/click/Done only.
- [P1] Escape inverted product-wide: receipt popovers commit on any dismissal incl. Esc (SearchReceipt onKey→close()→onCommit). Fix: Esc reverts to opening values, no commit; keep commit-on-dismiss for click-outside/Done.
- [P1] AA debt batch (AA is binding per PRODUCT.md): 10px/45% day labels (DayBlocks.tsx:139), placeholder-only airport input name (AirportInput.tsx:276), suppressed focus ring on field shell, light-mode black/40–50 sweep, missing aria-live on result count. Fix: per-theme muted tokens ≥4.5:1, ≥11px labels, aria-label, role="status".
- [P2] Months without deals vanish from Calendar (Dec/Feb absent, browser-verified; calendarMonths(deals) skips empty months). Fix: ghost grid or "No weekend flights found in December" placeholder.
- [P2] Map-pin click buries card title under pinned bar (scroll-mt-16 under-compensates; use measured --list-sticky-top as offset).

## Persona Red Flags

- Alex: no cancel in popovers (Esc reloads); reload collapses expanded card; month chips need two interactions; "Checked 17 min ago" not actionable (no refresh).
- Jordan: "direct"/"1 adult" don't read as buttons — may never find trip-length options; "Long weekends" explanation hidden in title attr; Escape trap silent.
- Sam: field shell shows no ring when chip × tabbed; map price-pill keyboard reachability unverified; 10px/45% day labels lowest-legibility element.

## Minor Observations

[P3] Soonest sort leads with 620 EUR outlier (Hurghada, only Sept deal) unframed. [P3] Day-strip bar has no sighted legend. [P3] Footer ~141 chars/line — max-w-prose. [P3] "1 adult" orphan wrap at 390; collapsed cards lack far-airport hint; stale calendar caption. Cognitive load: 7 controls in pinned bar; free-vs-reload distinction is a working-memory bridge in an 11px footnote. Emotional journey: austere first screen, photo peak hidden behind desktop hover; excellent peak-end footer line.

## Questions to Consider

1. If honesty is the brand, why is the with-bag price only visible after expanding?
2. Is commit-on-dismiss worth its Escape problem — Esc as true cancel, dismissal-commit kept for click-outside?
3. Where is the product's memory? ("Milan was 32 when you last looked — now 29.")

## Strengths

1. Cost-honesty pattern (DealCard "What it costs": fare+bag+total, unprompted).
2. Receipt-reloads / filters-are-free architecture with cross-facet dead-option disabling.
3. Accessibility as engineering: global :focus-visible with documented audit, sr-only sentences, real dialogs, reduced-motion coverage — corroborated by clean probes.
