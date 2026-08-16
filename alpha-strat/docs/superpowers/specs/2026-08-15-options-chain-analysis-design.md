# Phase 8b: Options Chain Analysis — Design Spec

## Goal

Use the options market as a sentiment indicator: surface what is being priced in for a given stock by analyzing the options chain with Black-Scholes pricing, Greeks, IV surface, expected move, and positioning data — then synthesize an institutional-grade AI narrative explaining the market's expectations.

## Architecture

Fetch options chain data from Yahoo Finance v7 (up to 4 near-term expiries). A pure TypeScript quant engine computes Black-Scholes pricing, Greeks, IV surface, expected move, put/call ratios, IV skew, unusual activity, and max pain. These pre-computed signals — along with existing quote data, fundamentals, and historical volatility — feed a Gemini Flash Lite prompt that produces a structured analysis of what the options market is pricing in. The Options tab in the watchlist detail panel visualizes the key signals and displays the AI narrative.

## Tech Stack

- Yahoo Finance v7 options endpoint (free, uses existing crumb/cookie auth)
- Yahoo Finance v8 chart for `^IRX` (risk-free rate — 13-week T-bill index)
- Pure TypeScript Black-Scholes + Greeks computation (`lib/finance/`)
- Gemini Flash Lite for AI narrative (existing provider, sufficient when fed pre-computed signals)
- Recharts for IV surface, IV term structure, and positioning charts
- Shared cache via `getOrFetch<T>({ shared: true })` — 4-hour TTL

## Global Constraints

- Zero recurring cost — no new API keys or paid services
- No Python — all Node.js
- Single Next.js deployment
- Follow existing patterns: lazy-loaded tabs, `*Fetched` boolean state, ticker-change reset, skeleton loading
- Recharts for all charts (already a dependency)
- Yahoo Finance crumb/cookie auth (already implemented)
- Options analysis framing: equity analyst using options as a sentiment indicator, NOT options trading advice

---

## 1. Data Layer

### 1.1 Yahoo Finance Options Chain Fetcher

**File:** `lib/market/yahoo-options.ts`

**Endpoint:** `https://query1.finance.yahoo.com/v7/finance/options/{ticker}?date={unixTimestamp}`

- Without `date` param: returns nearest expiry chain + array of all available expiry timestamps
- With `date` param: returns chain for that specific expiry

**Functions:**

```typescript
getOptionsChain(ticker: string, expiry?: number): Promise<RawOptionsResponse>
```
Fetches a single expiry's chain. Uses existing crumb/cookie auth from `yahoo.ts`.

```typescript
getAllNearTermChains(ticker: string): Promise<OptionsSnapshot>
```
1. Calls `getOptionsChain(ticker)` without expiry to get nearest chain + expiry list
2. Picks the next 3 closest expiries from the list
3. Fetches those 3 in parallel
4. Returns consolidated `OptionsSnapshot` with up to 4 chains + underlying price

**Auth:** Uses existing `getYahooCrumb()` from `yahoo.ts` (crumb + cookie). If v7 doesn't require crumb auth (some Yahoo endpoints don't), skip it — test during implementation.

### 1.2 Risk-Free Rate

Fetch the 13-week T-bill yield from Yahoo Finance `^IRX` via existing `getQuote("^IRX")`. The value comes back as a percentage (e.g., 5.25); divide by 100 for Black-Scholes input (0.0525).

Cache with shared cache, 24-hour TTL — the rate barely moves day-to-day.

Helper in `lib/finance/black-scholes.ts`:
```typescript
getRiskFreeRate(): Promise<number>
```

### 1.3 New Types in `lib/market/types.ts`

```typescript
interface OptionsContract {
  strike: number;
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  inTheMoney: boolean;
  contractType: "call" | "put";
  expiry: string; // ISO date
}

interface OptionsChain {
  expiryDate: string; // ISO date
  daysToExpiry: number;
  calls: OptionsContract[];
  puts: OptionsContract[];
}

interface OptionsSnapshot {
  ticker: string;
  underlyingPrice: number;
  chains: OptionsChain[];
  fetchedAt: string; // ISO timestamp
}
```

### 1.4 API Route: `GET /api/market/options-analysis`

**File:** `app/api/market/options-analysis/route.ts`

**Query params:** `ticker` (required)

**Auth:** `getClaims()` (fast JWT verification)

**Behavior:**
1. Validate ticker param
2. `getOrFetch<OptionsAnalysisResponse>` with shared cache, key `options-analysis-${ticker}`, type `"options-analysis"`, TTL = `OPTIONS_TTL` (4 hours)
3. On cache miss:
   a. Fetch options chains via `getAllNearTermChains(ticker)`
   b. Fetch risk-free rate via `getRiskFreeRate()`
   c. Fetch current quote (for 52-week range, recent performance context)
   d. Fetch fundamentals from shared cache (for next earnings date, consensus EPS)
   e. Compute all signals via `computeOptionsSignals(snapshot, riskFreeRate)`
   f. Compute historical volatility from price history
   g. Generate AI narrative via `generateOptionsAnalysis(signals, quoteContext, fundamentalsContext)`
   h. Return combined response

**Response shape:**

```typescript
interface OptionsAnalysisResponse {
  ticker: string;
  underlyingPrice: number;
  signals: OptionsSignals;
  analysis: {
    marketPositioning: string;
    expectedMoveAnalysis: string;
    volatilityAssessment: string;
    notableFlow: string;
    keyRisksAndCatalysts: string;
    actionableTakeaway: string;
  };
  ivSurface: Array<{
    moneyness: number; // % from ATM (-20 to +20)
    iv: number;
    expiry: string;
  }>;
  ivTermStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  positioning: Array<{
    strike: number;
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
    expiry: string;
  }>;
  expectedMove: {
    dollars: number;
    percent: number;
    upperBound: number;
    lowerBound: number;
  };
  maxPain: number;
  putCallRatio: number;
}
```

---

## 2. Quant Engine

### 2.1 Black-Scholes Pricing + Greeks

**File:** `lib/finance/black-scholes.ts`

All pure functions. Parameters: S (spot price), K (strike), T (time to expiry in years), r (risk-free rate as decimal), sigma (implied volatility as decimal), type ("call" | "put").

**Functions:**

```typescript
blackScholesPrice(S, K, T, r, sigma, type): number
```
Standard Black-Scholes European option pricing formula.

```typescript
impliedVolatility(marketPrice, S, K, T, r, type): number | null
```
Newton-Raphson iterative solver. Returns null if convergence fails (e.g., deep OTM options with zero bid). Used as fallback when Yahoo's IV field is missing.

```typescript
delta(S, K, T, r, sigma, type): number  // -1 to 1
gamma(S, K, T, r, sigma): number        // same for calls/puts
theta(S, K, T, r, sigma, type): number  // per-day decay
vega(S, K, T, r, sigma): number         // per 1% IV change, same for calls/puts
```

```typescript
getRiskFreeRate(): Promise<number>
```
Fetches `^IRX` via `getQuote`, divides by 100, caches 24hr shared.

**Implementation notes:**
- Uses the cumulative normal distribution function (implement or use a lightweight approximation — Abramowitz & Stegun is standard)
- T = daysToExpiry / 365
- All Greeks computed analytically (closed-form), not numerically

### 2.2 Options Signal Analysis

**File:** `lib/finance/options-analysis.ts`

Takes an `OptionsSnapshot` + risk-free rate, produces `OptionsSignals`:

```typescript
interface OptionsSignals {
  expectedMove: {
    dollars: number;
    percent: number;
    upperBound: number;
    lowerBound: number;
  };
  putCallRatio: number;
  ivSkew: {
    direction: "put-heavy" | "call-heavy" | "neutral";
    magnitude: number; // absolute difference in IV
  };
  maxPain: number;
  atmIv: number;
  historicalVolatility: number;
  ivRank: number | null; // IV vs historical vol, if we can compute
  unusualActivity: Array<{
    strike: number;
    expiry: string;
    type: "call" | "put";
    volume: number;
    openInterest: number;
    volumeOiRatio: number;
  }>;
  termStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  greeksSummary: {
    atmDelta: number;
    atmGamma: number;
    atmTheta: number;
    atmVega: number;
  };
}
```

**Functions:**

```typescript
expectedMove(chains, spotPrice): ExpectedMove
```
ATM straddle price for nearest expiry = expected move in dollars. ATM = strike closest to spot price. Expected move = ATM call price + ATM put price.

```typescript
putCallRatio(chain): number
```
Total put volume / total call volume for a given expiry.

```typescript
ivSkew(chain, spotPrice): IvSkew
```
Average IV of OTM puts (strikes 5-15% below spot) vs average IV of OTM calls (strikes 5-15% above spot). Difference and direction.

```typescript
ivSurface(chains, spotPrice): IvSurfacePoint[]
```
For each chain, sample strikes at moneyness intervals (-20% to +20% from ATM in 2.5% steps). Record the IV at each point. Produces data for the IV surface chart.

```typescript
unusualActivity(chain): UnusualActivityEntry[]
```
Flags contracts where volume > 2x open interest. Sorted by volume/OI ratio descending, top 5.

```typescript
maxPainStrike(chain): number
```
For each strike, calculate total intrinsic value that would be paid out to all option holders. The strike minimizing total payout is max pain.

```typescript
historicalVolatility(prices: number[]): number
```
Annualized standard deviation of daily log returns from the last 30 trading days of price history.

```typescript
computeOptionsSignals(snapshot, riskFreeRate, priceHistory): OptionsSignals
```
Orchestrator that calls all the above and assembles the signals object.

---

## 3. AI Narrative

**File:** `lib/ai/options-analysis.ts`

**Function:**
```typescript
generateOptionsAnalysis(
  signals: OptionsSignals,
  quoteContext: { price, change52w, recentPerformance },
  fundamentalsContext: { nextEarningsDate, consensusEps } | null
): Promise<OptionsAnalysisText>
```

**Provider:** Gemini Flash Lite (existing, sufficient when fed pre-computed signals)

**System prompt framing:** "You are a senior equity analyst at a top-tier investment bank. You use the options market as a sentiment indicator to understand what institutional investors and market makers are pricing in about a stock's future. You are NOT providing options trading advice — you are reading the options market to inform an equity view."

**User prompt includes:**
- Current price, 52-week range, recent performance
- Next earnings date and consensus EPS (if available)
- All computed signals: expected move ($ and %), put/call ratio, IV skew direction and magnitude, ATM IV vs historical volatility, term structure shape, max pain vs current price, unusual activity details (strike, expiry, volume, OI, call/put)
- Greeks summary at ATM strike

**Output structure (6 sections):**
1. **Market Positioning** — overall sentiment from aggregate flow, skew, and put/call ratio
2. **Expected Move Analysis** — priced-in move vs historical realized vol, whether it's elevated or compressed
3. **Volatility Assessment** — IV vs historical vol context, term structure shape (contango/backwardation), IV crush risk if near earnings
4. **Notable Flow** — unusual activity interpreted: what bets are being placed and what they suggest about expectations
5. **Key Risks & Catalysts** — what the options market is hedging against or speculating on, tied to known events (earnings, etc.)
6. **Actionable Takeaway** — concise bottom line: what this means for someone evaluating the stock

**Token budget:** Gemini's 2048 max output tokens is sufficient for 6 structured paragraphs.

---

## 4. UI: Options Tab

### 4.1 Tab Addition

Add `"options"` to the `Tab` union type in `ticker-detail-panel.tsx`. Insert as the 6th tab after Earnings. Follow the existing lazy-load pattern: `optionsFetched` boolean, fetch on first tab activation, reset on ticker change.

### 4.2 Layout — Five Vertically Stacked Sections

#### Section A: AI Options Analysis

The narrative from Gemini, rendered as 6 collapsible sections with headers matching the output structure (Market Positioning, Expected Move Analysis, Volatility Assessment, Notable Flow, Key Risks & Catalysts, Actionable Takeaway). Each section starts expanded. Similar visual treatment to the thesis tab's structured output.

#### Section B: Expected Move Gauge

A horizontal range bar showing:
- Current price as a center marker
- Expected move range (lower bound to upper bound) as a shaded region
- Max pain strike marked as a reference point
- Labels: expected move in $ and %, max pain value
- Color: neutral (zinc/gray) for the range, with the current price marker in white

#### Section C: IV Surface Chart (Recharts LineChart)

- **X-axis:** Moneyness (% from ATM), range -20% to +20%
- **Y-axis:** Implied Volatility (%)
- **Lines:** One per expiry (up to 4), different colors
- **Legend:** Expiry dates
- Reveals smile/smirk shape — steep left side = market hedging downside

#### Section D: IV Term Structure Chart (Recharts LineChart)

- **X-axis:** Expiry dates (or days to expiry)
- **Y-axis:** ATM IV (%)
- **Single line** connecting ATM IV across expiries
- A spike at one expiry vs neighbors = event pricing at that date
- If next earnings date is known, mark it on the x-axis

#### Section E: Positioning by Strike (Recharts BarChart)

- **X-axis:** Strike prices (filtered to meaningful range around ATM, e.g., +/- 15%)
- **Grouped bars:** Call volume (green) and put volume (red) per strike
- **For nearest expiry only** (to keep it focused)
- Shows where the market is concentrating bets
- Max pain strike highlighted with a reference line

### 4.3 Loading & Error States

- **Loading:** Skeleton placeholders (animated pulse divs), same pattern as other tabs
- **Error:** "Unable to load options data" — options endpoints can be flaky, no retry button
- **No data:** "No options data available for this ticker" — some small-cap stocks don't have listed options

---

## 5. Testing

### 5.1 Unit Tests: Black-Scholes + Greeks

**File:** `lib/finance/black-scholes.test.ts`

Test against known Black-Scholes values:
- Call and put pricing for standard inputs (S=100, K=100, T=1, r=0.05, sigma=0.2)
- Put-call parity verification: C - P = S - K*e^(-rT)
- Greeks boundary conditions (delta of deep ITM call ≈ 1, deep OTM ≈ 0)
- IV solver round-trip: compute price → solve for IV → should match original sigma
- IV solver returns null for degenerate inputs (zero price, negative time)

### 5.2 Unit Tests: Options Analysis

**File:** `lib/finance/options-analysis.test.ts`

- Expected move calculation with known straddle prices
- Put/call ratio computation
- IV skew direction detection
- Max pain calculation with simple chain data
- Unusual activity detection (volume > 2x OI threshold)
- Historical volatility computation against known values

### 5.3 Integration Verification

- Browser verification: expand a ticker with active options (e.g., AAPL, TSLA), click Options tab
- Verify AI narrative renders with all 6 sections
- Verify charts render with real data
- Verify shared cache: second load should be instant

---

## 6. Files Changed

**Created:**
- `lib/market/yahoo-options.ts` — Yahoo Finance v7 options chain fetcher
- `lib/finance/black-scholes.ts` — Black-Scholes pricing, Greeks, risk-free rate
- `lib/finance/options-analysis.ts` — aggregate signal computation
- `lib/ai/options-analysis.ts` — Gemini prompt for options narrative
- `app/api/market/options-analysis/route.ts` — API route with shared cache
- `lib/finance/black-scholes.test.ts` — Black-Scholes unit tests
- `lib/finance/options-analysis.test.ts` — signal computation unit tests

**Modified:**
- `lib/market/types.ts` — add OptionsContract, OptionsChain, OptionsSnapshot, OptionsSignals types
- `lib/cache/freshness.ts` — add OPTIONS_TTL (4 hours), RFR_TTL (24 hours)
- `app/watchlist/ticker-detail-panel.tsx` — add Options tab with 5 sections
- `DECISIONS.md` — document approach
- `CLAUDE.md` — add new files to key files section

---

## 7. What This Does NOT Include

- Options trading recommendations or strategies (buy this call, sell that put)
- Real-time streaming options data
- Historical IV tracking over time (would need persistent storage beyond cache)
- Options P&L simulation or payoff diagrams
- Multi-leg strategy analysis (spreads, straddles as trades)
- Options chain table with every individual contract listed
