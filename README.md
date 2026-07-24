# Weekend Escape

Finds the cheapest weekend round-trip flights from your home airport across a
future timeline. Built with Next.js + the Kiwi Tequila API.

## Setup

1. `npm install`
2. Create `.env.local`:
   ```
   TEQUILA_API_KEY=your_key
   WEEKEND_CURRENCY=EUR
   ```
   Get a key at https://partners.kiwi.com/
3. `npm run dev` and open http://localhost:3000

## How it works

- Set your home airport (type an IATA code or use geolocation).
- Pick a weekend style (**Fri–Sun** by default; also Fri–Mon / Thu–Mon) and
  timeline (1–6 months). Each preset is a *canonical shape* (the label's exact
  arrive/leave days); the search casts a wider net for cheaper fares, and results
  are split into that exact shape first, then a "close matches" section.
- One Tequila `/v2/search` call returns the cheapest weekend round-trip per
  destination; results are shown cheapest-first.

## Testing

`npm test` runs the Vitest suite.
