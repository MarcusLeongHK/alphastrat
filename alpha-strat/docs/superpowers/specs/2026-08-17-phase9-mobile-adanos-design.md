# Phase 9: Mobile Responsive + Adanos Maximization + Feature Polish

## Goal

Make AlphaStrat fully usable on mobile devices, maximize the Adanos free tier (250 req/month) by using batch and global endpoints, and ground the thesis AI prompt for accuracy.

## Architecture

Adaptive responsive layout using Tailwind breakpoints (`md:` at 768px). No separate mobile routes — same components render differently at each breakpoint. Adanos integration adds new API routes for batch sentiment and global market mood, all with shared caching and 24hr TTL.

## Tech Stack

- Tailwind CSS v4 responsive utilities (`md:`, `lg:`)
- Existing Recharts (already dynamically imported)
- Adanos REST API (free tier: 250 req/month, 100 req/min, 30 days history)
- Existing `getOrFetch<T>()` shared cache infrastructure

## Global Constraints

- No new npm dependencies
- All new API calls must be cached via `getOrFetch` with `{ shared: true }`
- Adanos monthly budget must stay under 250 requests
- Minimum touch target: 44px on mobile
- Minimum font size: 14px for body text on mobile
- All tables must have `overflow-x: auto` containers
- Dark mode must work on all new/modified components

---

## Track 1: Mobile-First Responsive Redesign

### 1.1 Responsive Header with Hamburger Menu

**Current problem:** The header renders all nav items (Watchlist, Portfolio, Macro, MarketStatus, email, logout) in a single horizontal row. On screens < 768px this overflows or wraps awkwardly.

**Design:**

- **Desktop (md+):** Keep current layout — horizontal nav with all items visible.
- **Mobile (<md):** Show only the AlphaStrat logo + a hamburger button. Tapping the hamburger opens a full-height slide-out menu from the right with nav links stacked vertically, user email, and logout button. Close on link click, outside click, or Escape key.

**Files:**
- Modify: `app/components/header.tsx` — convert to a client component wrapper that renders a `<MobileNav>` on small screens. The server-side `Header` still fetches the user, passes `user` as a prop to the client nav component.
- Create: `app/components/mobile-nav.tsx` — client component with hamburger toggle, slide-out panel, close-on-navigate behavior.

**Key details:**
- The hamburger icon: three horizontal lines (standard). Animated to X when open.
- Slide-out panel: fixed position, right-0, full height, `w-64`, white/zinc-950 background, `z-50`, with backdrop overlay.
- `safe-area-inset-top` padding on the slide-out for notch devices.
- Focus trap when open (tab stays inside the panel).

### 1.2 Watchlist: Card Layout on Mobile

**Current problem:** The watchlist table has 8 columns (Ticker, Price, Change, Next Earnings, EPS Est., Rating, Price Target, Remove). On mobile this requires horizontal scrolling, making it unusable.

**Design:**

- **Desktop (md+):** Keep current table layout.
- **Mobile (<md):** Render each ticker as a card. Each card shows:
  - Top row: Ticker (bold, left) + Price (right)
  - Second row: Change with color (left) + Rating badge (right)
  - Third row: Next Earnings date (if within 30 days, with countdown) + Remove button
  - Tap card → expand to show TickerDetailPanel below it

**Files:**
- Modify: `app/watchlist/watchlist-dashboard.tsx` — add a `useMediaQuery` check or simply render both layouts with Tailwind `hidden md:block` / `md:hidden` classes. The card layout renders from the same data maps (`quoteByTicker`, `earningsByTicker`, `analystByTicker`).

**Key details:**
- Cards get a `rounded-lg border` with `p-4`, stacked with `gap-3`.
- The expanded TickerDetailPanel renders below the card, not in a table `<td>`.
- Remove button is a small icon (trash) instead of "Remove" text, to save space.
- Touch feedback: `active:bg-zinc-100 dark:active:bg-zinc-800` on cards.

### 1.3 Ticker Detail Panel: Bottom Sheet on Mobile

**Current problem:** The TickerDetailPanel is a 1,926-line component that expands inline within the table. On mobile, this pushes content way down and the tab navigation is cramped.

**Design:**

- **Desktop (md+):** Keep current inline expansion.
- **Mobile (<md):** Render as a bottom sheet that slides up from the bottom of the screen. Covers ~85% of the viewport height. Has a drag handle at top, swipe-down to dismiss. Tab bar scrolls horizontally.

**Files:**
- Create: `app/watchlist/bottom-sheet.tsx` — generic bottom sheet wrapper component. Props: `open`, `onClose`, `title`, `children`. Uses CSS transform for slide animation, backdrop overlay, touch gesture detection for swipe-down dismiss.
- Modify: `app/watchlist/watchlist-dashboard.tsx` — on mobile, when a ticker is selected, render `<BottomSheet>` wrapping `<TickerDetailPanel>` instead of inline expansion.

**Key details:**
- Sheet height: `85vh` with `overflow-y: auto` for scrolling content.
- Drag handle: 40px wide, 4px tall, centered, rounded, zinc-300 color.
- Swipe gesture: track `touchstart`/`touchmove`/`touchend` Y delta. If dragged down > 100px, dismiss.
- Backdrop: `bg-black/50` with fade animation.
- Body scroll lock: set `overflow: hidden` on `<body>` when sheet is open.
- Tab bar inside the sheet: horizontal scroll with `-webkit-overflow-scrolling: touch`.
- Close when navigating away or pressing Escape.

### 1.4 Portfolio Dashboard: Stacked Mobile Layout

**Current problem:** The portfolio page has a 2-column grid (`lg:grid-cols-2`) for Allocation + Risk Metrics, plus a positions table that overflows.

**Design:**

- **Desktop:** Keep current layout.
- **Mobile:** 
  - Positions table: horizontal scroll container (already has `overflow-x-auto` but needs better column prioritization — hide less-important columns on mobile).
  - Allocation + Risk Metrics: full-width stacked cards (already happens at `< lg`, but ensure proper spacing).
  - Performance chart: full bleed on mobile, no horizontal padding.

**Files:**
- Modify: `app/portfolio/portfolio-dashboard.tsx` — add responsive classes.
- Modify: `app/portfolio/positions-table.tsx` — hide cost-basis and P&L columns on mobile (`hidden md:table-cell`), show only Ticker, Qty, Price, Change.

### 1.5 Macro Dashboard: Touch-Friendly Sections

**Current problem:** The macro dashboard is already card-based, but the settings gear icon and article links have small touch targets.

**Design:**
- Increase settings button to 44px touch target.
- Article links get `py-2` padding for touch.
- Section toggle checkboxes get larger touch areas (wrap label + checkbox in a button-like container).

**Files:**
- Modify: `app/macro/macro-dashboard.tsx` — adjust padding/sizing.

### 1.6 Global Responsive Utilities

**Files:**
- Modify: `app/globals.css` — add `safe-area-inset` padding utilities.
- Ensure `<html>` has `<meta name="viewport" content="width=device-width, initial-scale=1">` (should already be set by Next.js).

---

## Track 2: Adanos API Maximization

### 2.1 Batch Sentiment via /compare Endpoint

**Current problem:** Each ticker's sentiment costs 4 API calls (reddit, twitter, news, polymarket). A watchlist of 8 tickers = 32 calls on cache miss. With 250/month budget, that's unsustainable.

**Design:**

Add a new Adanos client function that uses the `/compare` endpoint to fetch sentiment for up to 10 tickers in one call per source.

**Files:**
- Modify: `lib/market/adanos.ts` — add `getAdanosCompareSentiment(tickers: string[], source: "reddit" | "twitter" | "news" | "polymarket")` function. Returns a `Map<string, AdanosSentiment>`.
- Create: `app/api/market/batch-sentiment/route.ts` — new API route that accepts `?tickers=AAPL,MSFT,...` and calls `/compare` for each enabled source. Shared cache with 24hr TTL, keyed as `adanos-batch:{sorted-tickers}:{source}`.
- Modify: `app/api/market/reddit-sentiment/route.ts` — update to prefer batch cache when available, fall back to single-ticker fetch.

**Adanos /compare endpoints (one per source):**
```
GET /reddit/stocks/v1/compare?tickers=AAPL,MSFT,GOOGL
GET /x/stocks/v1/compare?tickers=AAPL,MSFT,GOOGL
GET /news/stocks/v1/compare?tickers=AAPL,MSFT,GOOGL
GET /polymarket/stocks/v1/compare?tickers=AAPL,MSFT,GOOGL
```
Each returns an array of sentiment objects, one per ticker. Up to 10 tickers per request.

**Budget impact:** 4 calls instead of 4N for a batch of N tickers. Massive savings.

### 2.2 Enable News + Polymarket Sources

**Current problem:** `getAvailableSources()` hardcodes `["reddit", "twitter"]` even though the News and Polymarket client functions are fully implemented.

**Design:**
- Modify: `lib/market/adanos.ts` — update `getAvailableSources()` to return `["reddit", "twitter", "news", "polymarket"]`.

### 2.3 Trending + Market Sentiment for Macro Dashboard

**Current problem:** The macro dashboard only shows RSS-sourced news. Adanos has global endpoints that provide real social sentiment data.

**Design:**

Add a "Market Mood" section to the macro dashboard that shows:
- Overall market sentiment score (aggregate from Adanos `/market-sentiment`)
- Trending tickers on social media (from `/trending`)
- Sector sentiment breakdown (from `/trending/sectors`)

**Files:**
- Modify: `lib/market/adanos.ts` — add three new functions:
  - `getAdanosTrending()` — calls `GET /reddit/stocks/v1/trending`
  - `getAdanosMarketSentiment()` — calls `GET /reddit/stocks/v1/market-sentiment`
  - `getAdanosSectorTrending()` — calls `GET /reddit/stocks/v1/trending/sectors`
- Create: `app/api/macro/market-mood/route.ts` — API route that calls all three, shared cache 24hr TTL.
- Modify: `app/macro/macro-dashboard.tsx` — add "Market Mood" section at the top, above the RSS categories. Shows:
  - Sentiment gauge (bullish/bearish/neutral percentage bar)
  - Top 5 trending tickers with buzz scores
  - Sector sentiment heatmap (simple colored grid)

**Budget impact:** 3 calls per 24hr = ~3/day = ~90/month. Affordable.

### 2.4 AI Trend Explanation via /explain

**Current problem:** The sentiment tab shows raw numbers but lacks AI interpretation of what the social data means.

**Design:**

Add a "Social Trend Explanation" section to the sentiment tab in TickerDetailPanel. Uses Adanos's free `/stock/{ticker}/explain` endpoint which returns Llama 3.1-generated explanations.

**Files:**
- Modify: `lib/market/adanos.ts` — add `getAdanosExplain(ticker: string)` function.
- Modify: `app/api/market/reddit-sentiment/route.ts` — include explain data in response when available. Shared cache, 24hr TTL.
- Modify: `app/watchlist/ticker-detail-panel.tsx` — add the AI explanation card to the sentiment tab, below the existing comparison section.

**Budget impact:** ~1 call per ticker per 24hr. With 8 watchlist tickers: ~8/month.

### 2.5 Adanos Budget Tracking

**Design:**

Simple request counter stored in the cache table. Each `adanosFetch` call increments a shared cache entry `adanos-budget:{YYYY-MM}` (1-month TTL). Displayed as a small badge in the macro dashboard footer.

**Files:**
- Modify: `lib/market/adanos.ts` — after each successful fetch, increment the counter.
- Create: `app/api/adanos/usage/route.ts` — returns current month's usage count.
- Modify: `app/macro/macro-dashboard.tsx` — show usage badge (e.g., "42/250 API calls this month").

---

## Track 3: Feature Polish

### 3.1 Ground the Thesis AI Prompt

**Current problem:** The thesis system prompt says "Write with conviction. No hedging." This produces overconfident AI output that sounds authoritative but may not accurately reflect the underlying data — the same problem we fixed in the options prompt.

**Design:**

Rewrite `THESIS_SYSTEM_PROMPT` in `lib/ai/thesis.ts` with the same fact-first approach used for options:
- Lead with data, then interpret.
- Explicit thresholds: P/E < 15 = "cheap vs S&P median ~22", revenue growth > 15% = "above-average growth", etc.
- No claims about competitive moats unless the data shows margin stability over 5+ years.
- Bull/bear cases must cite specific numbers, not make sweeping claims.
- If the data is insufficient for a confident rating, say so with "Insufficient Data" rather than guessing.

**Files:**
- Modify: `lib/ai/thesis.ts` — rewrite `THESIS_SYSTEM_PROMPT`.

### 3.2 Macro Dashboard: Adanos Market Mood Integration

Covered in Track 2, Section 2.3 above.

---

## Testing Strategy

- **Mobile responsiveness:** Manual testing via browser dev tools at 375px (iPhone SE), 390px (iPhone 14), 768px (iPad). Verify:
  - Hamburger menu opens/closes
  - Watchlist cards render correctly
  - Bottom sheet slides up and dismisses
  - No horizontal page scroll
  - All touch targets >= 44px
- **Adanos integration:** Unit tests for new client functions with mocked responses. Integration test for batch endpoint.
- **Thesis grounding:** No automated test — verified by reading AI output before and after the prompt change.
- **Existing tests:** Must all pass (`npx vitest`).

## Budget Estimation (Adanos Monthly)

| Endpoint | Frequency | Calls/month |
|---|---|---|
| `/trending` | 1x/day (24hr cache) | ~30 |
| `/market-sentiment` | 1x/day (24hr cache) | ~30 |
| `/trending/sectors` | 1x/day (24hr cache) | ~30 |
| `/compare` (4 sources x 1 batch) | 1x/day per source | ~120 |
| `/stock/{ticker}/explain` | 1x/day x 8 tickers | ~8 |
| **Total** | | **~218** |

Comfortably within the 250/month limit, with ~30 calls buffer.

## Decision Log

This design will be recorded as Decision 57 in DECISIONS.md.
