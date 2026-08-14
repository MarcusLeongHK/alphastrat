# AI Thesis Generation — Design Spec

## Goal

Add a "Thesis" tab to the watchlist ticker detail panel that displays an LLM-generated, fundamentals-driven investment thesis with bull/bear/base cases, an investment rating, and a key metrics snapshot. Theses are generated on-demand (when the user clicks the tab), shared across all accounts via the shared cache pattern, and cached for 7 days.

## Architecture

The thesis feature sits on top of existing infrastructure: Yahoo Finance data (expanded with new fundamental modules), the `generateCompletion` AI client (Gemini Flash Lite), the shared cache via `getOrFetch<T>({ shared: true })`, and the watchlist detail panel's tab system.

**Data flow:** User clicks Thesis tab -> client fetches `GET /api/market/thesis?ticker=AAPL` -> API route checks shared cache (24h TTL) -> on miss, fetches fundamentals from Yahoo Finance + recent news headlines -> sends structured data to Gemini Flash Lite with a fundamentals-focused prompt -> caches result with `shared: true` -> returns thesis JSON to client.

## Components

### 1. Yahoo Finance Fundamentals Fetcher (`lib/market/yahoo.ts`)

Expand the existing `quoteSummary` integration to fetch all available fundamental modules in a single request. Currently the codebase makes separate `quoteSummary` calls for `calendarEvents,summaryDetail`, `financialData`, and `recommendationTrend`. For the thesis, we consolidate into one call requesting all modules:

**Modules to request:**
- `defaultKeyStatistics` — P/E, forward P/E, PEG ratio, price-to-book, price-to-sales, enterprise value, short interest (% of float), shares outstanding, float, beta, 52-week high/low
- `financialData` — current price, revenue, revenue growth, gross margins, operating margins, profit margins, EBITDA, free cash flow, operating cash flow, ROE, ROA, debt-to-equity, current ratio, total cash, total debt, analyst targets (already partially extracted)
- `earningsHistory` — last 4 quarters' EPS actual vs estimate (beat/miss history with surprise %)
- `incomeStatementHistory` — quarterly revenue and net income for trend analysis
- `balanceSheetHistory` — total assets, total liabilities, stockholders' equity, total debt, cash and equivalents
- `cashflowStatementHistory` — operating cash flow, capital expenditures, free cash flow, dividends paid
- `summaryProfile` — sector, industry, full-time employees, business summary (company description)

**New function:** `getTickerFundamentals(ticker: string): Promise<TickerFundamentals>`

This function makes a single `quoteSummary` call with all modules above, extracts every field into a typed `TickerFundamentals` interface, and returns it. The interface should have nullable fields since not all tickers have all data (e.g., ETFs lack earnings history).

**New type:** `TickerFundamentals` in `lib/market/types.ts`

```typescript
interface TickerFundamentals {
  ticker: string;
  // Profile
  sector: string | null;
  industry: string | null;
  employees: number | null;
  description: string | null;
  // Valuation
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  // Price context
  currentPrice: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta: number | null;
  // Profitability
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  // Growth
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  // Financial health
  totalCash: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  freeCashFlow: number | null;
  operatingCashFlow: number | null;
  // Short interest
  shortPercentOfFloat: number | null;
  sharesShort: number | null;
  // Analyst consensus
  recommendationKey: string | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  numberOfAnalysts: number | null;
  // Earnings history (last 4 quarters)
  earningsHistory: Array<{
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprisePercent: number | null;
  }>;
  // Income trend (last 4 quarters)
  quarterlyRevenue: Array<{
    quarter: string;
    revenue: number | null;
    netIncome: number | null;
  }>;
  // Cash flow (last 4 quarters)
  quarterlyCashFlow: Array<{
    quarter: string;
    operatingCashFlow: number | null;
    capitalExpenditures: number | null;
    freeCashFlow: number | null;
  }>;
}
```

### 2. Thesis AI Module (`lib/ai/thesis.ts`)

**System prompt** instructs the LLM to act as a long-term equity research analyst. Key prompt characteristics:
- Fundamentals-driven analysis: reason about revenue durability, margin trajectory, competitive moats, capital allocation discipline, balance sheet health, and valuation relative to intrinsic value
- Long-term investment horizon (3-5 years)
- Institutional-investor quality: name specific numbers from the data, cite revenue growth rates, margin trends, debt ratios, FCF yield
- No hedging language ("could potentially," "might be") — write with conviction
- Each case (bull/bear/base) up to 8 sentences
- Investment rating must flow from the analysis, not the other way around

**Input to the LLM:** A structured text block containing:
1. Company profile (sector, industry, description)
2. All fundamental metrics from `TickerFundamentals`
3. Earnings history (beat/miss pattern)
4. Revenue and income trends
5. Cash flow trends
6. Recent news headlines (from the existing news fetch, max 8 headlines — titles only, not full articles)
7. Analyst consensus and price targets

**Output format:** The LLM returns structured JSON (using Gemini's JSON response mode or parsed from markdown). The response shape:

```typescript
interface ThesisResponse {
  ticker: string;
  rating: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  ratingRationale: string; // 1-2 sentences
  bullCase: string; // up to 8 sentences
  bearCase: string; // up to 8 sentences
  baseCase: string; // up to 8 sentences
  keyMetrics: {
    label: string;
    value: string;
    context: string; // e.g., "vs industry avg 15x"
  }[];
  generatedAt: string; // ISO timestamp
}
```

**Function:** `generateThesis(fundamentals: TickerFundamentals, newsHeadlines: string[]): Promise<ThesisResponse>`

The prompt should format all the fundamental data into a readable text block, instruct the LLM to return JSON matching the `ThesisResponse` shape, and parse the response. If parsing fails, return a fallback with an error message in the base case field.

The `keyMetrics` array should be LLM-selected — the model picks the 6-8 most relevant metrics for this specific ticker and provides context (e.g., "P/E of 28x vs sector median 22x" or "FCF yield 4.2% supports dividend growth").

### 3. Thesis API Route (`app/api/market/thesis/route.ts`)

**Endpoint:** `GET /api/market/thesis?ticker=AAPL`

**Auth:** `getClaims()` — standard JWT verification (same as other market data routes).

**Cache:** Uses `getOrFetch<ThesisResponse>()` with:
- `cacheKey`: `thesis-{ticker}` (e.g., `thesis-AAPL`)
- `cacheType`: `thesis`
- `ttlSeconds`: `THESIS_TTL` (keep existing 7 days = 604800)
- `shared: true` — all users see the same thesis for a given ticker

**Fetcher flow:**
1. Fetch fundamentals: `getTickerFundamentals(ticker)`
2. Fetch recent news headlines: `getNews(ticker)` (existing function, extract titles only)
3. Generate thesis: `generateThesis(fundamentals, headlines)`
4. Return the `ThesisResponse`

**`shouldCache` predicate:** Cache if the thesis has non-empty bull, bear, and base cases.

### 4. Thesis Tab UI (`app/watchlist/ticker-detail-panel.tsx`)

Add "Thesis" as a 4th tab in the existing detail panel.

**Tab type update:** `type Tab = "overview" | "news" | "sentiment" | "thesis";`

**Data fetching:** On-demand — only fetch when `activeTab === "thesis"`, same pattern as the existing sentiment tab. Track `thesisFetched` and `thesisData` state.

**Thesis tab layout:**

1. **Loading state:** Skeleton with "Generating thesis..." text (this can take a few seconds on first load)

2. **Rating header:** Large rating label (e.g., "Buy") with color coding (green for buy, amber for hold, red for sell) + 1-2 sentence rationale below it

3. **Key metrics grid:** 2-column grid showing the LLM-selected metrics with labels, values, and context. Compact design matching the existing panel style.

4. **Three cases in sequence:**
   - **Bull Case** — green accent border left, expandable section (default expanded)
   - **Bear Case** — red accent border left, expandable section (default expanded)
   - **Base Case** — amber accent border left, expandable section (default expanded)
   - Each case is a paragraph of up to 8 sentences

5. **Footer:** "Generated {timeAgo}" timestamp + refresh button. Refresh button triggers a new fetch with `?refresh=true` query param (API route deletes the existing shared cache entry before fetching fresh).

**Error state:** If thesis generation fails, show "Unable to generate thesis. Try again later." with a retry button.

### 5. Cache TTL (`lib/cache/freshness.ts`)

Keep `THESIS_TTL` at `7 * 24 * 3600` (7 days). Fundamentals don't change rapidly, and 7 days avoids unnecessary re-generation. Users can still force a refresh via the refresh button.

## Global Constraints

- **Cost:** Gemini Flash Lite free tier. Each thesis generation is one API call with ~2-3k input tokens (fundamentals + news) and ~1k output tokens (structured JSON response). On-demand generation + shared cache means cost scales with unique tickers viewed, not unique users.
- **No new tables:** Theses are cached in the existing `cache` table via shared cache pattern.
- **No new dependencies:** Uses existing `generateCompletion` with Gemini, existing Yahoo Finance fetcher pattern, existing cache infrastructure.
- **Existing patterns:** Follow the same patterns as `macro-summary.ts` for AI generation, `reddit-sentiment` route for on-demand fetching, and macro news for shared caching.

## Testing

- Unit test for `getTickerFundamentals` — mock Yahoo Finance response, verify extraction
- Unit test for thesis prompt builder — verify all fundamental data is included in the prompt text
- Manual verification: click Thesis tab in browser, confirm thesis loads, confirm cache hit on second load, confirm shared across accounts

## Files

**Create:**
- `lib/ai/thesis.ts` — thesis generation (prompt + LLM call + response parsing)
- `app/api/market/thesis/route.ts` — thesis API route

**Modify:**
- `lib/market/yahoo.ts` — add `getTickerFundamentals()` function
- `lib/market/types.ts` — add `TickerFundamentals` and `ThesisResponse` types
- `lib/cache/freshness.ts` — no change needed (`THESIS_TTL` already 7 days)
- `app/watchlist/ticker-detail-panel.tsx` — add Thesis tab
- `DECISIONS.md` — add decision for thesis architecture
- `CLAUDE.md` — add thesis files to key files list
