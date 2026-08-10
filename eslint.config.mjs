// KNOWN LINT DEBT (as of 2026-07-27): `npm run lint` reports 34 problems — 33
// `@typescript-eslint/no-explicit-any` (mostly `deals.ts` plus several test
// files) and one unused import in `AirportInput.test.tsx`. All are mechanical;
// none are suppressed and none block `npm run build`, which does not gate on
// lint. Worth clearing in one pass before wiring CI, since CI would fail on
// them today.
//
// The `react-hooks/set-state-in-effect` errors that used to sit alongside these
// are resolved: two were converted to render-phase state adjustments, and the
// remaining three carry inline `eslint-disable-next-line` directives with the
// reason they must stay effects (SSR-time `window` access in `page.tsx`; a
// shared module cache that can settle between render and effect in
// `CheapestWeekend.tsx` and `AirportInput.tsx` — converting those would strand
// a card on its loading state). Read those comments before "fixing" them.

import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party bundles served as-is — linting a 447 KB minified
    // worker produces ~1000 meaningless warnings and drowns the real ones.
    "public/**",
  ]),
]);

export default eslintConfig;
