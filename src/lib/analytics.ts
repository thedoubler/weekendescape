// The app's custom product events, funnel order:
//
//   search         a board search returned (activation)
//   deal_expanded  someone opened a card to read the details (intent)
//   outbound_click a hand-off to Kiwi / Booking (the revenue moment)
//
// track() talks to the PostHog handle instrumentation-client.ts leaves on
// window — never to an import. That keeps posthog-js out of every component
// chunk, and makes the whole thing an automatic no-op wherever PostHog didn't
// initialise: dev, keyless builds, SSR, tests. Properties must stay in the
// vocabulary of the product (codes, counts, prices), never anything typed by
// or about the person — the About page promises measurement, not identity.
type Capture = { capture: (event: string, props?: Record<string, unknown>) => void };

export function track(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    (window as { __ph?: Capture }).__ph?.capture(event, props);
  } catch {
    // Analytics must never break the product.
  }
}
