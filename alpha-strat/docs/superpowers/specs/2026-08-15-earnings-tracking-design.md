# Phase 8a: Earnings Beat/Miss Tracking — Design Spec

## Goal

Surface historical earnings performance (beat/miss trends, surprise %, revenue trajectory) and forward estimates in a new Earnings tab within the watchlist detail panel, using data already cached by the thesis fundamentals endpoint.

## Architecture

Extend the existing `getTickerFundamentals` call to include `earningsTrend` and `calendarEvents` modules (9 total, single Yahoo Finance request). A new thin API route projects the earnings-relevant fields from the shared fundamentals cache. The Earnings tab in the detail panel visualizes this data with Recharts charts — no AI generation, pure data visualization.

## Tech Stack

- Yahoo Finance quoteSummary (earningsTrend + calendarEvents modules added to existing call)
- Recharts (BarChart, LineChart — already in the project)
- Shared cache via `getOrFetch<T>({ shared: true })` — 7-day TTL (reuses thesis cache)

## Global Constraints

- Zero recurring cost — no new API keys or paid services
- No Python — all Node.js
- Single Next.js deployment
- Follow existing patterns: lazy-loaded tabs, `*Fetched` boolean state, ticker-change reset, skeleton loading
- Recharts for all charts (already a dependency)
- Cache reuse: the earnings tab reads from the same shared fundamentals cache as the thesis tab

---

## 1. Data Layer Changes

### 1.1 Extend `TickerFundamentals` type

Add a new field to the existing `TickerFundamentals` interface in `lib/market/types.ts`:

```typescript
earningsTrend: Array<{
  period: string;              // "0q" (current quarter), "+1q" (next quarter), "0y" (current year), "+1y" (next year)
  epsEstimate: number | null;
  epsGrowth: number | null;    // decimal, e.g., 0.15 = 15% growth
  revenueEstimate: number | null;
  revenueGrowth: number | null;
}>;
```

### 1.2 Extend `getTickerFundamentals` in `lib/market/yahoo.ts`

Add two modules to the existing comma-separated list:
- `earningsTrend` — forward-looking EPS/revenue estimates with growth rates
- `calendarEvents` — next earnings date (already fetched by `getEarnings` separately, now consolidated)

The modules list becomes: `defaultKeyStatistics,financialData,summaryDetail,summaryProfile,earningsHistory,incomeStatementHistory,cashflowStatementHistory,earningsTrend,calendarEvents`

Add extraction logic in `extractFundamentals` for the new `earningsTrend` field. The Yahoo response structure for `earningsTrend` is:

```
earningsTrend.trend[]: {
  period: string,
  earningsEstimate: { avg: { raw }, growth: { raw } },
  revenueEstimate: { avg: { raw }, growth: { raw } }
}
```

Also extract `nextEarningsDate` from `calendarEvents.earnings.earningsDate[0].raw` into a new field on `TickerFundamentals`:

```typescript
nextEarningsDate: string | null;  // ISO date string
```

### 1.3 New API route: `GET /api/market/earnings-detail`

**File:** `app/api/market/earnings-detail/route.ts`

**Query params:** `ticker` (required)

**Auth:** `getClaims()` (fast JWT verification)

**Behavior:**
1. Validate ticker param
2. Call `getOrFetch<TickerFundamentals>` with shared cache, key `fundamentals:{ticker}`, type `fundamentals`, TTL = `THESIS_TTL` (7 days) — this is the SAME cache key the thesis route uses, so if the user already viewed the thesis, this is an instant cache hit
3. Project and return only earnings-relevant fields:

```typescript
interface EarningsDetailResponse {
  ticker: string;
  earningsHistory: Array<{
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprisePercent: number | null;
  }>;
  earningsTrend: Array<{
    period: string;
    epsEstimate: number | null;
    epsGrowth: number | null;
    revenueEstimate: number | null;
    revenueGrowth: number | null;
  }>;
  quarterlyRevenue: Array<{
    quarter: string;
    revenue: number | null;
    netIncome: number | null;
  }>;
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextRevenueEstimate: number | null;
}
```

The `nextEpsEstimate` and `nextRevenueEstimate` fields come from the `earningsTrend` entry with period `"0q"` (current quarter).

---

## 2. UI: Earnings Tab

### 2.1 Tab Addition

Add `"earnings"` to the `Tab` union type in `ticker-detail-panel.tsx`. Insert it as the 5th tab after Thesis. Follow the existing lazy-load pattern: `earningsFetched` boolean, fetch on first tab activation, reset on ticker change.

### 2.2 Layout

Three vertically stacked sections within the tab:

#### Section A: Next Earnings Card

A compact card showing:
- **Earnings date** with relative countdown ("in 12 days", "3 days ago")
- **EPS consensus** — the `nextEpsEstimate` value with "Consensus EPS" label
- **Revenue consensus** — the `nextRevenueEstimate` value formatted in $B/$M
- **Forward EPS growth** — from the `+1q` earningsTrend entry, shown as a percentage badge (green if positive, red if negative)
- If no earnings date is available, show "No upcoming earnings date"

#### Section B: EPS Beat/Miss Chart (Recharts BarChart)

A grouped bar chart showing 4 quarters of historical earnings:
- **X-axis:** Quarter labels (e.g., "Q2 2024") — derived from the `quarter` field in earningsHistory
- **Two bars per quarter:** EPS Estimate (zinc/gray) and EPS Actual (emerald if beat, red if miss — determined by comparing actual vs estimate)
- **Surprise % label** above each actual bar (e.g., "+4.2%", "-1.8%")
- **Responsive:** chart fills container width, bars auto-size
- **Empty state:** "No historical earnings data available"

#### Section C: Revenue Trend Chart (Recharts ComposedChart)

A bar + line chart showing 4 quarters from `quarterlyRevenue`:
- **Bars:** Revenue per quarter (blue/indigo fill)
- **Line overlay:** Net Income trend line (emerald or red based on positive/negative)
- **Y-axis:** Formatted in $B/$M (use existing `formatRevenue` helper)
- **X-axis:** Quarter labels
- **Empty state:** "No revenue data available"

### 2.3 Loading & Error States

- **Loading:** Skeleton placeholders (3 animated pulse divs), same pattern as other tabs
- **Error:** "Unable to load earnings data" with no retry button (cached data, unlikely to fail transiently)
- **No data:** Per-section empty states as described above

---

## 3. Testing

### 3.1 Unit test: `earningsTrend` extraction

Add test cases to the existing `lib/market/yahoo-fundamentals.test.ts`:
- Full extraction test: mock quoteSummary with earningsTrend and calendarEvents modules, verify all new fields are correctly mapped
- Null safety test: missing earningsTrend/calendarEvents returns empty array and null date

### 3.2 Integration verification

- Browser verification: expand a ticker, click Earnings tab, confirm chart renders with real data
- Verify shared cache reuse: after viewing Thesis tab, Earnings tab should load instantly (same cache key)

---

## 4. Files Changed

**Modified:**
- `lib/market/types.ts` — add `earningsTrend` array and `nextEarningsDate` to `TickerFundamentals`
- `lib/market/yahoo.ts` — add 2 modules to fetch, extend `extractFundamentals`
- `lib/market/yahoo-fundamentals.test.ts` — add test cases for new fields
- `app/watchlist/ticker-detail-panel.tsx` — add Earnings tab with charts
- `lib/cache/freshness.ts` — no changes needed (reuses THESIS_TTL)
- `DECISIONS.md` — document the approach
- `CLAUDE.md` — add new API route to key files

**Created:**
- `app/api/market/earnings-detail/route.ts` — thin projection over fundamentals cache

---

## 5. What This Does NOT Include

- AI-generated earnings analysis (pure data visualization)
- Options chain data (Phase 8b)
- Cross-ticker earnings calendar improvements (existing calendar on watchlist page stays as-is)
- Revenue estimates for historical quarters (Yahoo only provides actuals)
