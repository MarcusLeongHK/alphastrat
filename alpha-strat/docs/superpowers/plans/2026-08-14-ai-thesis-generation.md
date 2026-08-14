# AI Thesis Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Thesis" tab to the watchlist ticker detail panel that shows an LLM-generated, fundamentals-driven investment thesis with bull/bear/base cases, an investment rating, and key metrics.

**Architecture:** On-demand thesis generation via Gemini Flash Lite, backed by a comprehensive Yahoo Finance `quoteSummary` fetch (7 modules in one call). Theses are shared-cached for 7 days across all users via the existing `getOrFetch<T>({ shared: true })` pattern. The Thesis tab in the watchlist detail panel fetches lazily (only when clicked), matching the existing sentiment tab pattern.

**Tech Stack:** Next.js 16.3 (App Router), TypeScript, Tailwind CSS v4, Supabase (cache table), Gemini Flash Lite (via `generateCompletion`), Yahoo Finance v10 quoteSummary REST API.

## Global Constraints

- **Cost:** $0/month — Gemini Flash Lite free tier only. Shared cache means cost scales with unique tickers, not users.
- **No new tables:** Theses live in the existing `cache` table via `shared: true`.
- **No new dependencies:** All existing libraries. No npm additions.
- **Runtime:** Pure Node.js `fetch()` — no Python, no heavy SDKs.
- **AI quality:** Institutional-investor level. No hedging language. Name specific numbers. Long-term (3-5 year) investment horizon. Up to 8 sentences per case.
- **Patterns:** Follow `macro-summary.ts` for AI generation, `reddit-sentiment` route for on-demand fetching, macro news for shared caching. Follow existing `quoteSummary` auth pattern (crumb+cookie via `getYahooCrumb()`).

---

### Task 1: Types + Yahoo Finance Fundamentals Fetcher

**Files:**
- Modify: `lib/market/types.ts` — add `TickerFundamentals` and `ThesisResponse` interfaces
- Modify: `lib/market/yahoo.ts` — add `getTickerFundamentals()` function
- Create: `lib/market/yahoo-fundamentals.test.ts` — unit test for extraction logic

**Interfaces:**
- Consumes: existing `getYahooCrumb()` function (private in `yahoo.ts`, reuse internally)
- Produces: `TickerFundamentals` type (used by Task 2), `getTickerFundamentals(ticker: string): Promise<TickerFundamentals>` (used by Task 3)

- [ ] **Step 1: Add types to `lib/market/types.ts`**

Add these interfaces at the end of the file:

```typescript
export interface TickerFundamentals {
  ticker: string;
  sector: string | null;
  industry: string | null;
  employees: number | null;
  description: string | null;
  marketCap: number | null;
  enterpriseValue: number | null;
  trailingPE: number | null;
  forwardPE: number | null;
  pegRatio: number | null;
  priceToBook: number | null;
  priceToSales: number | null;
  currentPrice: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  beta: number | null;
  grossMargins: number | null;
  operatingMargins: number | null;
  profitMargins: number | null;
  returnOnEquity: number | null;
  returnOnAssets: number | null;
  revenueGrowth: number | null;
  earningsGrowth: number | null;
  totalCash: number | null;
  totalDebt: number | null;
  debtToEquity: number | null;
  currentRatio: number | null;
  freeCashFlow: number | null;
  operatingCashFlow: number | null;
  shortPercentOfFloat: number | null;
  sharesShort: number | null;
  recommendationKey: string | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
  numberOfAnalysts: number | null;
  earningsHistory: Array<{
    quarter: string;
    epsActual: number | null;
    epsEstimate: number | null;
    surprisePercent: number | null;
  }>;
  quarterlyRevenue: Array<{
    quarter: string;
    revenue: number | null;
    netIncome: number | null;
  }>;
  quarterlyCashFlow: Array<{
    quarter: string;
    operatingCashFlow: number | null;
    capitalExpenditures: number | null;
    freeCashFlow: number | null;
  }>;
}

export interface ThesisResponse {
  ticker: string;
  rating: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell";
  ratingRationale: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  keyMetrics: Array<{
    label: string;
    value: string;
    context: string;
  }>;
  generatedAt: string;
}
```

- [ ] **Step 2: Write the test for `getTickerFundamentals` extraction**

Create `lib/market/yahoo-fundamentals.test.ts`. The test mocks a full Yahoo Finance `quoteSummary` response with all 7 modules and verifies `extractFundamentals` correctly maps every field. Export the extraction logic as a pure function `extractFundamentals` so it can be tested without network calls.

```typescript
import { describe, it, expect } from "vitest";
import { extractFundamentals } from "./yahoo";

const mockQuoteSummaryResult = {
  summaryProfile: {
    sector: "Technology",
    industry: "Consumer Electronics",
    fullTimeEmployees: 164000,
    longBusinessSummary: "Apple Inc. designs, manufactures, and markets smartphones.",
  },
  defaultKeyStatistics: {
    enterpriseValue: { raw: 3200000000000 },
    forwardPE: { raw: 28.5 },
    pegRatio: { raw: 2.1 },
    priceToBook: { raw: 45.2 },
    priceToSalesTrailing12Months: { raw: 8.3 },
    shortPercentOfFloat: { raw: 0.007 },
    sharesShort: { raw: 120000000 },
    beta: { raw: 1.24 },
    "52WeekChange": { raw: 0.15 },
    fiftyTwoWeekHigh: { raw: 237.49 },
    fiftyTwoWeekLow: { raw: 164.08 },
    trailingEps: { raw: 6.42 },
  },
  financialData: {
    currentPrice: { raw: 225.0 },
    totalRevenue: { raw: 383000000000 },
    revenueGrowth: { raw: 0.05 },
    grossMargins: { raw: 0.462 },
    operatingMargins: { raw: 0.312 },
    profitMargins: { raw: 0.263 },
    ebitda: { raw: 130000000000 },
    freeCashFlow: { raw: 111000000000 },
    operatingCashflow: { raw: 122000000000 },
    returnOnEquity: { raw: 1.47 },
    returnOnAssets: { raw: 0.22 },
    debtToEquity: { raw: 181.0 },
    currentRatio: { raw: 0.99 },
    totalCash: { raw: 62000000000 },
    totalDebt: { raw: 108000000000 },
    earningsGrowth: { raw: 0.08 },
    recommendationKey: "buy",
    recommendationMean: { raw: 2.0 },
    numberOfAnalystOpinions: { raw: 40 },
    targetMeanPrice: { raw: 240.0 },
    targetHighPrice: { raw: 280.0 },
    targetLowPrice: { raw: 190.0 },
  },
  summaryDetail: {
    marketCap: { raw: 3500000000000 },
    trailingPE: { raw: 35.0 },
  },
  earningsHistory: {
    history: [
      {
        quarter: { fmt: "4Q2025" },
        epsActual: { raw: 2.4 },
        epsEstimate: { raw: 2.35 },
        surprisePercent: { raw: 0.021 },
      },
      {
        quarter: { fmt: "3Q2025" },
        epsActual: { raw: 1.64 },
        epsEstimate: { raw: 1.59 },
        surprisePercent: { raw: 0.031 },
      },
    ],
  },
  incomeStatementHistory: {
    incomeStatementHistory: [
      {
        endDate: { fmt: "2025-12-31" },
        totalRevenue: { raw: 124000000000 },
        netIncome: { raw: 33000000000 },
      },
      {
        endDate: { fmt: "2025-09-30" },
        totalRevenue: { raw: 94000000000 },
        netIncome: { raw: 22000000000 },
      },
    ],
  },
  cashflowStatementHistory: {
    cashflowStatements: [
      {
        endDate: { fmt: "2025-12-31" },
        totalCashFromOperatingActivities: { raw: 40000000000 },
        capitalExpenditures: { raw: -3000000000 },
        freeCashFlow: { raw: 37000000000 },
      },
    ],
  },
};

describe("extractFundamentals", () => {
  it("extracts all fundamental fields from quoteSummary response", () => {
    const result = extractFundamentals("AAPL", mockQuoteSummaryResult);

    expect(result.ticker).toBe("AAPL");
    expect(result.sector).toBe("Technology");
    expect(result.industry).toBe("Consumer Electronics");
    expect(result.employees).toBe(164000);
    expect(result.description).toBe("Apple Inc. designs, manufactures, and markets smartphones.");
    expect(result.marketCap).toBe(3500000000000);
    expect(result.enterpriseValue).toBe(3200000000000);
    expect(result.trailingPE).toBe(35.0);
    expect(result.forwardPE).toBe(28.5);
    expect(result.pegRatio).toBe(2.1);
    expect(result.priceToBook).toBe(45.2);
    expect(result.priceToSales).toBe(8.3);
    expect(result.currentPrice).toBe(225.0);
    expect(result.fiftyTwoWeekHigh).toBe(237.49);
    expect(result.fiftyTwoWeekLow).toBe(164.08);
    expect(result.beta).toBe(1.24);
    expect(result.grossMargins).toBe(0.462);
    expect(result.operatingMargins).toBe(0.312);
    expect(result.profitMargins).toBe(0.263);
    expect(result.returnOnEquity).toBe(1.47);
    expect(result.returnOnAssets).toBe(0.22);
    expect(result.revenueGrowth).toBe(0.05);
    expect(result.earningsGrowth).toBe(0.08);
    expect(result.totalCash).toBe(62000000000);
    expect(result.totalDebt).toBe(108000000000);
    expect(result.debtToEquity).toBe(181.0);
    expect(result.currentRatio).toBe(0.99);
    expect(result.freeCashFlow).toBe(111000000000);
    expect(result.operatingCashFlow).toBe(122000000000);
    expect(result.shortPercentOfFloat).toBe(0.007);
    expect(result.sharesShort).toBe(120000000);
    expect(result.recommendationKey).toBe("buy");
    expect(result.targetMeanPrice).toBe(240.0);
    expect(result.numberOfAnalysts).toBe(40);

    expect(result.earningsHistory).toHaveLength(2);
    expect(result.earningsHistory[0]).toEqual({
      quarter: "4Q2025",
      epsActual: 2.4,
      epsEstimate: 2.35,
      surprisePercent: 0.021,
    });

    expect(result.quarterlyRevenue).toHaveLength(2);
    expect(result.quarterlyRevenue[0]).toEqual({
      quarter: "2025-12-31",
      revenue: 124000000000,
      netIncome: 33000000000,
    });

    expect(result.quarterlyCashFlow).toHaveLength(1);
    expect(result.quarterlyCashFlow[0]).toEqual({
      quarter: "2025-12-31",
      operatingCashFlow: 40000000000,
      capitalExpenditures: -3000000000,
      freeCashFlow: 37000000000,
    });
  });

  it("returns nulls for missing modules", () => {
    const result = extractFundamentals("ETF", {});

    expect(result.ticker).toBe("ETF");
    expect(result.sector).toBeNull();
    expect(result.marketCap).toBeNull();
    expect(result.earningsHistory).toEqual([]);
    expect(result.quarterlyRevenue).toEqual([]);
    expect(result.quarterlyCashFlow).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run lib/market/yahoo-fundamentals.test.ts`
Expected: FAIL — `extractFundamentals` is not exported from `./yahoo`

- [ ] **Step 4: Implement `extractFundamentals` and `getTickerFundamentals` in `lib/market/yahoo.ts`**

Add `extractFundamentals` as an exported pure function, and `getTickerFundamentals` as the async function that calls Yahoo Finance and delegates to it.

The `extractFundamentals` function takes `(ticker: string, result: Record<string, unknown>)` and returns `TickerFundamentals`. It reads from each module using the `?.raw` pattern already used in the file (see `YahooRawValue`). For array fields (`earningsHistory`, `incomeStatementHistory`, `cashflowStatementHistory`), iterate the sub-arrays and extract each entry.

The `getTickerFundamentals` function:
1. Calls `getYahooCrumb()` for auth
2. Fetches `quoteSummary` with modules: `defaultKeyStatistics,financialData,summaryDetail,summaryProfile,earningsHistory,incomeStatementHistory,cashflowStatementHistory`
3. Passes the result to `extractFundamentals`
4. On any error, returns a fundamentals object with all nulls and empty arrays

The `quoteSummary` URL format (already used in the file): `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}&crumb=${crumb}`

Headers (already used): `User-Agent: USER_AGENT`, `Cookie: auth.cookie`

```typescript
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFundamentals(ticker: string, result: any): TickerFundamentals {
  const profile = result?.summaryProfile;
  const keyStats = result?.defaultKeyStatistics;
  const financial = result?.financialData;
  const summary = result?.summaryDetail;
  const ehRaw = result?.earningsHistory?.history ?? [];
  const incomeRaw = result?.incomeStatementHistory?.incomeStatementHistory ?? [];
  const cashRaw = result?.cashflowStatementHistory?.cashflowStatements ?? [];

  return {
    ticker,
    sector: profile?.sector ?? null,
    industry: profile?.industry ?? null,
    employees: profile?.fullTimeEmployees ?? null,
    description: profile?.longBusinessSummary ?? null,
    marketCap: summary?.marketCap?.raw ?? null,
    enterpriseValue: keyStats?.enterpriseValue?.raw ?? null,
    trailingPE: summary?.trailingPE?.raw ?? null,
    forwardPE: keyStats?.forwardPE?.raw ?? null,
    pegRatio: keyStats?.pegRatio?.raw ?? null,
    priceToBook: keyStats?.priceToBook?.raw ?? null,
    priceToSales: keyStats?.priceToSalesTrailing12Months?.raw ?? null,
    currentPrice: financial?.currentPrice?.raw ?? null,
    fiftyTwoWeekHigh: keyStats?.fiftyTwoWeekHigh?.raw ?? null,
    fiftyTwoWeekLow: keyStats?.fiftyTwoWeekLow?.raw ?? null,
    beta: keyStats?.beta?.raw ?? null,
    grossMargins: financial?.grossMargins?.raw ?? null,
    operatingMargins: financial?.operatingMargins?.raw ?? null,
    profitMargins: financial?.profitMargins?.raw ?? null,
    returnOnEquity: financial?.returnOnEquity?.raw ?? null,
    returnOnAssets: financial?.returnOnAssets?.raw ?? null,
    revenueGrowth: financial?.revenueGrowth?.raw ?? null,
    earningsGrowth: financial?.earningsGrowth?.raw ?? null,
    totalCash: financial?.totalCash?.raw ?? null,
    totalDebt: financial?.totalDebt?.raw ?? null,
    debtToEquity: financial?.debtToEquity?.raw ?? null,
    currentRatio: financial?.currentRatio?.raw ?? null,
    freeCashFlow: financial?.freeCashFlow?.raw ?? null,
    operatingCashFlow: financial?.operatingCashflow?.raw ?? null,
    shortPercentOfFloat: keyStats?.shortPercentOfFloat?.raw ?? null,
    sharesShort: keyStats?.sharesShort?.raw ?? null,
    recommendationKey: financial?.recommendationKey ?? null,
    targetMeanPrice: financial?.targetMeanPrice?.raw ?? null,
    targetHighPrice: financial?.targetHighPrice?.raw ?? null,
    targetLowPrice: financial?.targetLowPrice?.raw ?? null,
    numberOfAnalysts: financial?.numberOfAnalystOpinions?.raw ?? null,
    earningsHistory: ehRaw.map((e: any) => ({
      quarter: e.quarter?.fmt ?? "",
      epsActual: e.epsActual?.raw ?? null,
      epsEstimate: e.epsEstimate?.raw ?? null,
      surprisePercent: e.surprisePercent?.raw ?? null,
    })),
    quarterlyRevenue: incomeRaw.map((s: any) => ({
      quarter: s.endDate?.fmt ?? "",
      revenue: s.totalRevenue?.raw ?? null,
      netIncome: s.netIncome?.raw ?? null,
    })),
    quarterlyCashFlow: cashRaw.map((c: any) => ({
      quarter: c.endDate?.fmt ?? "",
      operatingCashFlow: c.totalCashFromOperatingActivities?.raw ?? null,
      capitalExpenditures: c.capitalExpenditures?.raw ?? null,
      freeCashFlow: c.freeCashFlow?.raw ?? null,
    })),
  };
}

export async function getTickerFundamentals(ticker: string): Promise<TickerFundamentals> {
  const empty = extractFundamentals(ticker, {});

  try {
    const auth = await getYahooCrumb();
    if (!auth) return empty;

    const modules = [
      "defaultKeyStatistics",
      "financialData",
      "summaryDetail",
      "summaryProfile",
      "earningsHistory",
      "incomeStatementHistory",
      "cashflowStatementHistory",
    ].join(",");

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker
    )}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: auth.cookie,
      },
    });

    if (!response.ok) return empty;

    const json = (await response.json()) as YahooQuoteSummaryResponse;
    if (json.quoteSummary.error) return empty;

    const result = json.quoteSummary.result?.[0];
    if (!result) return empty;

    return extractFundamentals(ticker, result);
  } catch {
    return empty;
  }
}
```

Add `TickerFundamentals` to the import line at the top of `yahoo.ts`:

```typescript
import { QuoteData, HistoricalBar, EarningsData, AnalystData, NewsArticle, RecommendationTrend, RecommendationPeriod, TickerFundamentals } from "./types";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/market/yahoo-fundamentals.test.ts`
Expected: PASS (both tests)

- [ ] **Step 6: Run full test suite + lint + typecheck**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add lib/market/types.ts lib/market/yahoo.ts lib/market/yahoo-fundamentals.test.ts
git commit -m "feat(thesis): add TickerFundamentals type and Yahoo Finance fundamentals fetcher"
```

---

### Task 2: Thesis AI Module (`lib/ai/thesis.ts`)

**Files:**
- Create: `lib/ai/thesis.ts` — thesis prompt builder, LLM call, response parsing

**Interfaces:**
- Consumes: `TickerFundamentals` from `lib/market/types.ts` (Task 1), `generateCompletion(system, user, "gemini")` from `lib/ai/client.ts`
- Produces: `generateThesis(fundamentals: TickerFundamentals, newsHeadlines: string[]): Promise<ThesisResponse>` (used by Task 3)

- [ ] **Step 1: Create `lib/ai/thesis.ts`**

This file has three parts:
1. `THESIS_SYSTEM_PROMPT` — system prompt for the LLM
2. `buildThesisPrompt(fundamentals, newsHeadlines)` — formats data into LLM input
3. `generateThesis(fundamentals, newsHeadlines)` — calls `generateCompletion` and parses JSON response

```typescript
import { generateCompletion } from "./client";
import type { TickerFundamentals, ThesisResponse } from "@/lib/market/types";

const THESIS_SYSTEM_PROMPT = `You are a senior equity research analyst writing an investment thesis for institutional investors. Your analysis is fundamentals-driven with a 3-5 year investment horizon.

Rules:
- Write with conviction. No hedging ("could potentially", "might be", "it remains to be seen"). State your view directly.
- Cite specific numbers from the data: revenue growth rates, margin percentages, debt ratios, FCF yield, P/E multiples.
- Each case (bull, bear, base) must be up to 8 sentences. Be thorough and specific.
- The investment rating must flow logically from your analysis — derive it from the bull/bear/base cases, don't pick it first.
- For keyMetrics, select the 6-8 most relevant metrics for THIS specific company and add context (e.g., "vs sector median 22x", "supports 3% dividend yield", "improved from 15% last year").
- Focus on: revenue durability, margin trajectory, competitive moats, capital allocation discipline, balance sheet health, and valuation relative to intrinsic value.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "rating": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "ratingRationale": "1-2 sentence summary of why this rating",
  "bullCase": "up to 8 sentences",
  "bearCase": "up to 8 sentences",
  "baseCase": "up to 8 sentences",
  "keyMetrics": [
    { "label": "metric name", "value": "formatted value", "context": "comparison or insight" }
  ]
}`;

function formatNumber(n: number | null, prefix = ""): string {
  if (n === null) return "N/A";
  if (Math.abs(n) >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  return `${prefix}${n.toLocaleString()}`;
}

function formatPercent(n: number | null): string {
  if (n === null) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

function formatRatio(n: number | null): string {
  if (n === null) return "N/A";
  return n.toFixed(2);
}

export function buildThesisPrompt(
  fundamentals: TickerFundamentals,
  newsHeadlines: string[]
): string {
  const sections: string[] = [];

  sections.push(`=== COMPANY PROFILE ===
Ticker: ${fundamentals.ticker}
Sector: ${fundamentals.sector ?? "N/A"}
Industry: ${fundamentals.industry ?? "N/A"}
Employees: ${fundamentals.employees?.toLocaleString() ?? "N/A"}
Description: ${fundamentals.description ?? "N/A"}`);

  sections.push(`=== VALUATION ===
Market Cap: ${formatNumber(fundamentals.marketCap, "$")}
Enterprise Value: ${formatNumber(fundamentals.enterpriseValue, "$")}
Trailing P/E: ${formatRatio(fundamentals.trailingPE)}
Forward P/E: ${formatRatio(fundamentals.forwardPE)}
PEG Ratio: ${formatRatio(fundamentals.pegRatio)}
Price/Book: ${formatRatio(fundamentals.priceToBook)}
Price/Sales: ${formatRatio(fundamentals.priceToSales)}
Current Price: $${fundamentals.currentPrice?.toFixed(2) ?? "N/A"}
52-Week High: $${fundamentals.fiftyTwoWeekHigh?.toFixed(2) ?? "N/A"}
52-Week Low: $${fundamentals.fiftyTwoWeekLow?.toFixed(2) ?? "N/A"}
Beta: ${formatRatio(fundamentals.beta)}`);

  sections.push(`=== PROFITABILITY ===
Gross Margin: ${formatPercent(fundamentals.grossMargins)}
Operating Margin: ${formatPercent(fundamentals.operatingMargins)}
Net Margin: ${formatPercent(fundamentals.profitMargins)}
ROE: ${formatPercent(fundamentals.returnOnEquity)}
ROA: ${formatPercent(fundamentals.returnOnAssets)}`);

  sections.push(`=== GROWTH ===
Revenue Growth (YoY): ${formatPercent(fundamentals.revenueGrowth)}
Earnings Growth (YoY): ${formatPercent(fundamentals.earningsGrowth)}`);

  sections.push(`=== FINANCIAL HEALTH ===
Total Cash: ${formatNumber(fundamentals.totalCash, "$")}
Total Debt: ${formatNumber(fundamentals.totalDebt, "$")}
Debt/Equity: ${formatRatio(fundamentals.debtToEquity)}
Current Ratio: ${formatRatio(fundamentals.currentRatio)}
Free Cash Flow: ${formatNumber(fundamentals.freeCashFlow, "$")}
Operating Cash Flow: ${formatNumber(fundamentals.operatingCashFlow, "$")}`);

  sections.push(`=== SHORT INTEREST ===
Short % of Float: ${formatPercent(fundamentals.shortPercentOfFloat)}
Shares Short: ${fundamentals.sharesShort?.toLocaleString() ?? "N/A"}`);

  sections.push(`=== ANALYST CONSENSUS ===
Recommendation: ${fundamentals.recommendationKey ?? "N/A"}
Mean Target: $${fundamentals.targetMeanPrice?.toFixed(2) ?? "N/A"}
High Target: $${fundamentals.targetHighPrice?.toFixed(2) ?? "N/A"}
Low Target: $${fundamentals.targetLowPrice?.toFixed(2) ?? "N/A"}
Number of Analysts: ${fundamentals.numberOfAnalysts ?? "N/A"}`);

  if (fundamentals.earningsHistory.length > 0) {
    const ehLines = fundamentals.earningsHistory.map(
      (e) =>
        `  ${e.quarter}: Actual EPS $${e.epsActual?.toFixed(2) ?? "N/A"} vs Est $${e.epsEstimate?.toFixed(2) ?? "N/A"} (${e.surprisePercent !== null ? `${(e.surprisePercent * 100).toFixed(1)}% surprise` : "N/A"})`
    );
    sections.push(`=== EARNINGS HISTORY (Last ${fundamentals.earningsHistory.length} Quarters) ===\n${ehLines.join("\n")}`);
  }

  if (fundamentals.quarterlyRevenue.length > 0) {
    const revLines = fundamentals.quarterlyRevenue.map(
      (r) =>
        `  ${r.quarter}: Revenue ${formatNumber(r.revenue, "$")}, Net Income ${formatNumber(r.netIncome, "$")}`
    );
    sections.push(`=== QUARTERLY INCOME ===\n${revLines.join("\n")}`);
  }

  if (fundamentals.quarterlyCashFlow.length > 0) {
    const cfLines = fundamentals.quarterlyCashFlow.map(
      (c) =>
        `  ${c.quarter}: OpCF ${formatNumber(c.operatingCashFlow, "$")}, CapEx ${formatNumber(c.capitalExpenditures, "$")}, FCF ${formatNumber(c.freeCashFlow, "$")}`
    );
    sections.push(`=== QUARTERLY CASH FLOW ===\n${cfLines.join("\n")}`);
  }

  if (newsHeadlines.length > 0) {
    sections.push(`=== RECENT NEWS ===\n${newsHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`);
  }

  return `Generate an investment thesis for ${fundamentals.ticker}.\n\n${sections.join("\n\n")}`;
}

export async function generateThesis(
  fundamentals: TickerFundamentals,
  newsHeadlines: string[]
): Promise<ThesisResponse> {
  const userPrompt = buildThesisPrompt(fundamentals, newsHeadlines);

  const raw = await generateCompletion(THESIS_SYSTEM_PROMPT, userPrompt, "gemini");

  const cleaned = raw
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Omit<ThesisResponse, "ticker" | "generatedAt">;

    const validRatings = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"];
    const rating = validRatings.includes(parsed.rating) ? parsed.rating : "Hold";

    return {
      ticker: fundamentals.ticker,
      rating: rating as ThesisResponse["rating"],
      ratingRationale: parsed.ratingRationale || "Unable to determine rating rationale.",
      bullCase: parsed.bullCase || "Insufficient data for bull case analysis.",
      bearCase: parsed.bearCase || "Insufficient data for bear case analysis.",
      baseCase: parsed.baseCase || "Insufficient data for base case analysis.",
      keyMetrics: Array.isArray(parsed.keyMetrics) ? parsed.keyMetrics : [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ticker: fundamentals.ticker,
      rating: "Hold",
      ratingRationale: "Thesis generation encountered a parsing error.",
      bullCase: "Unable to generate bull case. Please try refreshing.",
      bearCase: "Unable to generate bear case. Please try refreshing.",
      baseCase: "Unable to generate base case. Please try refreshing.",
      keyMetrics: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
```

- [ ] **Step 2: Increase Gemini `maxOutputTokens` for thesis generation**

The existing `generateCompletion` in `lib/ai/client.ts` has `maxOutputTokens: 2048` for Gemini. This should be sufficient for the thesis JSON response (~1k tokens), but verify it is not too low. The thesis prompt is large (~2-3k input tokens) and the response needs room for 3 cases of 8 sentences each plus key metrics. 2048 output tokens is adequate — no change needed.

- [ ] **Step 3: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add lib/ai/thesis.ts
git commit -m "feat(thesis): add thesis AI module with fundamentals-driven prompt"
```

---

### Task 3: Thesis API Route + Cache

**Files:**
- Create: `app/api/market/thesis/route.ts`

**Interfaces:**
- Consumes: `getTickerFundamentals` from `lib/market/yahoo.ts` (Task 1), `generateThesis` from `lib/ai/thesis.ts` (Task 2), `getNews` from `lib/market/yahoo.ts`, `getOrFetch` from `lib/cache/index.ts`, `THESIS_TTL` from `lib/cache/freshness.ts`, `createClient` from `lib/supabase/server.ts`
- Produces: `GET /api/market/thesis?ticker=AAPL` returning `ThesisResponse` JSON (used by Task 4)

- [ ] **Step 1: Create the API route**

Create `app/api/market/thesis/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { THESIS_TTL } from "@/lib/cache/freshness";
import { getTickerFundamentals, getNews } from "@/lib/market/yahoo";
import { generateThesis } from "@/lib/ai/thesis";
import type { ThesisResponse } from "@/lib/market/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticker = request.nextUrl.searchParams.get("ticker");
    if (!ticker) {
      return NextResponse.json(
        { error: "ticker parameter is required" },
        { status: 400 }
      );
    }

    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    if (refresh) {
      await supabase
        .from("cache")
        .delete()
        .eq("cache_key", `thesis-${ticker.toUpperCase()}`)
        .is("user_id", null);
    }

    const { data } = await getOrFetch<ThesisResponse>(
      supabase,
      `thesis-${ticker.toUpperCase()}`,
      "thesis",
      THESIS_TTL,
      async () => {
        const [fundamentals, newsArticles] = await Promise.all([
          getTickerFundamentals(ticker.toUpperCase()),
          getNews(ticker.toUpperCase()),
        ]);

        const headlines = newsArticles.map((a) => a.title);
        return generateThesis(fundamentals, headlines);
      },
      {
        shouldCache: (result) =>
          result.bullCase.length > 0 &&
          !result.bullCase.startsWith("Unable to generate") &&
          result.bearCase.length > 0 &&
          !result.bearCase.startsWith("Unable to generate"),
        shared: true,
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to generate thesis: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add app/api/market/thesis/route.ts
git commit -m "feat(thesis): add thesis API route with shared cache and refresh support"
```

---

### Task 4: Thesis Tab UI + DECISIONS.md + CLAUDE.md

**Files:**
- Modify: `app/watchlist/ticker-detail-panel.tsx` — add Thesis tab with on-demand fetch and full thesis card UI
- Modify: `DECISIONS.md` — add decision for thesis architecture
- Modify: `CLAUDE.md` — add thesis files to key files list

**Interfaces:**
- Consumes: `GET /api/market/thesis?ticker=AAPL` (Task 3), `ThesisResponse` type from `lib/market/types.ts` (Task 1)
- Produces: Thesis tab visible in the watchlist detail panel (end-user feature)

- [ ] **Step 1: Add `ThesisResponse` interface and state to `ticker-detail-panel.tsx`**

At the top of the file, add the `ThesisResponse` interface (matching `lib/market/types.ts` — the component is `"use client"` so it can't import server-side types directly; redeclare the interface locally as is done for the other types like `TickerNews`, `RecommendationTrend`, etc.):

```typescript
interface ThesisKeyMetric {
  label: string;
  value: string;
  context: string;
}

interface ThesisData {
  ticker: string;
  rating: string;
  ratingRationale: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  keyMetrics: ThesisKeyMetric[];
  generatedAt: string;
}
```

Update the Tab type:

```typescript
type Tab = "overview" | "news" | "sentiment" | "thesis";
```

Add state variables inside `TickerDetailPanel`:

```typescript
const [thesisData, setThesisData] = useState<ThesisData | null>(null);
const [thesisFetched, setThesisFetched] = useState(false);
const [thesisLoading, setThesisLoading] = useState(false);
const [thesisError, setThesisError] = useState(false);
```

Add reset logic in the `if (ticker !== prevTicker)` block:

```typescript
setThesisData(null);
setThesisFetched(false);
setThesisError(false);
```

- [ ] **Step 2: Add thesis fetch effect**

Add the on-demand fetch `useEffect`, matching the existing sentiment tab pattern:

```typescript
useEffect(() => {
  if (activeTab !== "thesis" || thesisFetched) return;

  let cancelled = false;
  setThesisLoading(true);

  fetch(`/api/market/thesis?ticker=${ticker}`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ThesisData>;
    })
    .then((data) => {
      if (!cancelled) {
        setThesisData(data);
        setThesisFetched(true);
        setThesisLoading(false);
      }
    })
    .catch(() => {
      if (!cancelled) {
        setThesisError(true);
        setThesisFetched(true);
        setThesisLoading(false);
      }
    });

  return () => {
    cancelled = true;
  };
}, [ticker, activeTab, thesisFetched]);
```

Add a refresh handler:

```typescript
const handleThesisRefresh = useCallback(() => {
  setThesisData(null);
  setThesisFetched(false);
  setThesisError(false);
  setThesisLoading(true);

  fetch(`/api/market/thesis?ticker=${ticker}&refresh=true`)
    .then(async (res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ThesisData>;
    })
    .then((data) => {
      setThesisData(data);
      setThesisFetched(true);
      setThesisLoading(false);
    })
    .catch(() => {
      setThesisError(true);
      setThesisFetched(true);
      setThesisLoading(false);
    });
}, [ticker]);
```

Add `useCallback` to the import at the top of the file (it already imports `useEffect` and `useState`).

- [ ] **Step 3: Add the Thesis tab button**

Update the tabs array:

```typescript
const tabs: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "news", label: "News" },
  { key: "sentiment", label: "Sentiment" },
  { key: "thesis", label: "Thesis" },
];
```

- [ ] **Step 4: Add the Thesis tab content**

Add a helper function for rating colors (above the component):

```typescript
function thesisRatingColor(rating: string): string {
  if (rating === "Strong Buy" || rating === "Buy") return "text-emerald-500";
  if (rating === "Hold") return "text-amber-500";
  return "text-red-500";
}

function thesisRatingBg(rating: string): string {
  if (rating === "Strong Buy" || rating === "Buy") return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50";
  if (rating === "Hold") return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50";
  return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50";
}
```

Add the thesis tab rendering block after the sentiment tab's closing `)}`:

```tsx
{activeTab === "thesis" && (
  <div className="flex flex-col gap-4">
    {thesisLoading ? (
      <div className="flex flex-col items-center gap-3 py-8">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
        <p className="text-xs text-zinc-400">Generating thesis...</p>
      </div>
    ) : thesisError ? (
      <div className="flex flex-col items-center gap-2 py-6">
        <p className="text-xs text-zinc-400">Unable to generate thesis. Try again later.</p>
        <button
          onClick={handleThesisRefresh}
          className="rounded-md bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
        >
          Retry
        </button>
      </div>
    ) : thesisData ? (
      <>
        {/* Rating Header */}
        <div className={`rounded-lg border p-4 ${thesisRatingBg(thesisData.rating)}`}>
          <div className="flex items-baseline justify-between">
            <span className={`text-xl font-bold ${thesisRatingColor(thesisData.rating)}`}>
              {thesisData.rating}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              Investment Rating
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            {thesisData.ratingRationale}
          </p>
        </div>

        {/* Key Metrics Grid */}
        {thesisData.keyMetrics.length > 0 && (
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Key Metrics
            </h4>
            <div className="grid grid-cols-2 gap-3">
              {thesisData.keyMetrics.map((metric, i) => (
                <div key={i} className="flex flex-col">
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {metric.label}
                  </span>
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {metric.value}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {metric.context}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bull Case */}
        <div className="rounded-lg border border-l-4 border-zinc-200 border-l-emerald-500 p-4 dark:border-zinc-800 dark:border-l-emerald-400">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            Bull Case
          </h4>
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {thesisData.bullCase}
          </p>
        </div>

        {/* Bear Case */}
        <div className="rounded-lg border border-l-4 border-zinc-200 border-l-red-500 p-4 dark:border-zinc-800 dark:border-l-red-400">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-red-600 dark:text-red-400">
            Bear Case
          </h4>
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {thesisData.bearCase}
          </p>
        </div>

        {/* Base Case */}
        <div className="rounded-lg border border-l-4 border-zinc-200 border-l-amber-500 p-4 dark:border-zinc-800 dark:border-l-amber-400">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            Base Case
          </h4>
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {thesisData.baseCase}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
            Generated {timeAgo(thesisData.generatedAt)}
          </span>
          <button
            onClick={handleThesisRefresh}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </>
    ) : null}
  </div>
)}
```

- [ ] **Step 5: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: All pass

- [ ] **Step 6: Start dev server and manually test**

Run: `npm run dev`

Test steps:
1. Navigate to `/watchlist`
2. Expand a ticker row (e.g., AAPL)
3. Click the "Thesis" tab
4. Verify the loading spinner appears ("Generating thesis...")
5. Verify the thesis renders: rating header with color, key metrics grid, bull/bear/base cases with colored accent borders, timestamp footer
6. Reload the page, click Thesis tab again — verify it loads instantly (cache hit, no spinner or brief spinner)
7. Click the Refresh button — verify a new thesis is generated (timestamp updates)

- [ ] **Step 7: Add decision to DECISIONS.md**

Add Decision 52 at the end of DECISIONS.md (before the closing line):

```markdown
---

## Decision 52: AI Thesis Generation — Fundamentals-Driven with Shared Cache

**Date:** Phase 7 (2026-08-14)

**Options considered:**
1. **Pre-generate theses for all watchlist tickers** — background job on page load
2. **On-demand generation with per-user cache** — generate when clicked, cached per user
3. **On-demand generation with shared cache** — generate when clicked, shared across all users

**Decision:** On-demand generation with shared 7-day cache via `getOrFetch<T>({ shared: true })`

**Reasoning:** Fundamental data and AI-generated theses are ticker-specific, not user-specific — every user viewing AAPL gets the same P/E, margins, and FCF data, so the thesis is identical. Shared caching means the first user to view a ticker pays the generation cost (one Yahoo Finance fetch + one Gemini call), and all subsequent users get an instant cache hit. 7-day TTL matches the pace of fundamental data changes — quarterly earnings are the primary catalyst, and a refresh button provides an escape hatch. On-demand generation avoids wasting Gemini API calls on tickers nobody expands, which matters for the free tier's rate limits. The fundamentals fetcher consolidates 7 Yahoo Finance `quoteSummary` modules into a single request, minimizing network overhead.
```

- [ ] **Step 8: Update CLAUDE.md key files list**

Add these lines to the Key Files section in CLAUDE.md:

```markdown
- `lib/ai/thesis.ts` — fundamentals-driven thesis generation (Gemini Flash Lite)
- `app/api/market/thesis/route.ts` — thesis API route (shared cache, 7d TTL)
```

- [ ] **Step 9: Commit**

```bash
git add app/watchlist/ticker-detail-panel.tsx DECISIONS.md CLAUDE.md
git commit -m "feat(thesis): add Thesis tab to watchlist detail panel with bull/bear/base cases"
```

- [ ] **Step 10: Run full test suite**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: All pass
