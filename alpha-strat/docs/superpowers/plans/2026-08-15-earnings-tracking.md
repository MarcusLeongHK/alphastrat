# Earnings Beat/Miss Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Earnings tab to the watchlist detail panel showing historical EPS beat/miss charts, revenue trends, forward estimates, and next earnings countdown — all from Yahoo Finance data already partially fetched by the thesis endpoint.

**Architecture:** Extend `getTickerFundamentals` with 2 additional quoteSummary modules (`earningsTrend`, `calendarEvents`), cache the raw fundamentals with a shared 7-day TTL via a new API route, and render the data in a new Earnings tab using Recharts bar/line charts.

**Tech Stack:** Yahoo Finance quoteSummary, Recharts (BarChart, ComposedChart — already a dependency), shared cache via `getOrFetch<T>({ shared: true })`

## Global Constraints

- Zero recurring cost — no new API keys or paid services
- No Python — all Node.js `fetch()`
- Single Next.js deployment on Vercel free tier
- `cookies()` is async in Next.js 16
- `useActionState` (React 19) for forms
- `"use client"` components redeclare interfaces locally instead of importing from server-side types
- ESLint: `react-hooks/set-state-in-effect` prevents `setState` in effects — use derived values (e.g., `const loading = !fetched`)
- ESLint: `react-hooks/refs` prevents ref updates during render — use `useEffect`
- Follow existing patterns: lazy-loaded tabs (`*Fetched` boolean state), ticker-change reset, skeleton loading
- Recharts for all charts (already a dependency — import from `"recharts"`)
- Cache keys: the thesis route caches `ThesisResponse` under key `thesis-${TICKER}` (type `"thesis"`). This plan caches `TickerFundamentals` separately under key `fundamentals-${TICKER}` (type `"fundamentals"`) — different data shape, own cache entry, same 7-day shared TTL
- Update `DECISIONS.md` as Decision 53
- Update `CLAUDE.md` key files section with new API route

---

### Task 1: Extend TickerFundamentals Type + Yahoo Extraction + Tests

**Files:**
- Modify: `lib/market/types.ts:79-148` (TickerFundamentals interface)
- Modify: `lib/market/yahoo.ts:476-585` (extractFundamentals + getTickerFundamentals)
- Modify: `lib/market/yahoo-fundamentals.test.ts` (add test cases)

**Interfaces:**
- Consumes: existing `extractFundamentals(ticker: string, result: any): TickerFundamentals` function
- Produces: extended `TickerFundamentals` with two new fields:
  - `earningsTrend: Array<{ period: string; epsEstimate: number | null; epsGrowth: number | null; revenueEstimate: number | null; revenueGrowth: number | null }>`
  - `nextEarningsDate: string | null`

- [ ] **Step 1: Write failing tests for earningsTrend and nextEarningsDate extraction**

Add to `lib/market/yahoo-fundamentals.test.ts`. First, extend the existing `mockQuoteSummaryResult` object with `earningsTrend` and `calendarEvents` modules. Then add two new test cases.

Add these two properties to `mockQuoteSummaryResult` (after the existing `cashflowStatementHistory` block):

```typescript
  earningsTrend: {
    trend: [
      {
        period: "0q",
        earningsEstimate: { avg: { raw: 1.89 }, growth: { raw: 0.08 } },
        revenueEstimate: { avg: { raw: 95200000000 }, growth: { raw: 0.05 } },
      },
      {
        period: "+1q",
        earningsEstimate: { avg: { raw: 2.45 }, growth: { raw: 0.12 } },
        revenueEstimate: { avg: { raw: 128000000000 }, growth: { raw: 0.07 } },
      },
      {
        period: "0y",
        earningsEstimate: { avg: { raw: 7.10 }, growth: { raw: 0.10 } },
        revenueEstimate: { avg: { raw: 410000000000 }, growth: { raw: 0.06 } },
      },
      {
        period: "+1y",
        earningsEstimate: { avg: { raw: 7.85 }, growth: { raw: 0.11 } },
        revenueEstimate: { avg: { raw: 445000000000 }, growth: { raw: 0.08 } },
      },
    ],
  },
  calendarEvents: {
    earnings: {
      earningsDate: [{ raw: 1753920000 }],
    },
  },
```

Then add these assertions to the **existing** "extracts all fundamental fields" test, after the `quarterlyCashFlow` assertions:

```typescript
    expect(result.earningsTrend).toHaveLength(4);
    expect(result.earningsTrend[0]).toEqual({
      period: "0q",
      epsEstimate: 1.89,
      epsGrowth: 0.08,
      revenueEstimate: 95200000000,
      revenueGrowth: 0.05,
    });
    expect(result.earningsTrend[1]).toEqual({
      period: "+1q",
      epsEstimate: 2.45,
      epsGrowth: 0.12,
      revenueEstimate: 128000000000,
      revenueGrowth: 0.07,
    });

    expect(result.nextEarningsDate).toBe("2025-07-31");
```

And add these assertions to the **existing** "returns nulls for missing modules" test:

```typescript
    expect(result.earningsTrend).toEqual([]);
    expect(result.nextEarningsDate).toBeNull();
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/market/yahoo-fundamentals.test.ts`
Expected: FAIL — `earningsTrend` and `nextEarningsDate` properties don't exist on the return type

- [ ] **Step 3: Add earningsTrend and nextEarningsDate fields to TickerFundamentals type**

In `lib/market/types.ts`, add these two fields to the `TickerFundamentals` interface, after the existing `quarterlyCashFlow` field (before the closing `}`):

```typescript
  earningsTrend: Array<{
    period: string;
    epsEstimate: number | null;
    epsGrowth: number | null;
    revenueEstimate: number | null;
    revenueGrowth: number | null;
  }>;
  nextEarningsDate: string | null;
```

- [ ] **Step 4: Add extraction logic in extractFundamentals**

In `lib/market/yahoo.ts`, in the `extractFundamentals` function:

1. Add these lines after the existing `const cashRaw = ...` line:

```typescript
  const etRaw = result?.earningsTrend?.trend ?? [];
  const calEarnings = result?.calendarEvents?.earnings;
  const earningsTimestamp = calEarnings?.earningsDate?.[0]?.raw;
```

2. Add these two fields to the return object, after `quarterlyCashFlow`:

```typescript
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    earningsTrend: etRaw.map((e: any) => ({
      period: e.period ?? "",
      epsEstimate: e.earningsEstimate?.avg?.raw ?? null,
      epsGrowth: e.earningsEstimate?.growth?.raw ?? null,
      revenueEstimate: e.revenueEstimate?.avg?.raw ?? null,
      revenueGrowth: e.revenueEstimate?.growth?.raw ?? null,
    })),
    nextEarningsDate:
      earningsTimestamp != null
        ? new Date(earningsTimestamp * 1000).toISOString().slice(0, 10)
        : null,
```

- [ ] **Step 5: Add earningsTrend and calendarEvents to the modules list**

In `lib/market/yahoo.ts`, in `getTickerFundamentals`, update the `modules` array. The current array is:

```typescript
    const modules = [
      "defaultKeyStatistics",
      "financialData",
      "summaryDetail",
      "summaryProfile",
      "earningsHistory",
      "incomeStatementHistory",
      "cashflowStatementHistory",
    ].join(",");
```

Change it to:

```typescript
    const modules = [
      "defaultKeyStatistics",
      "financialData",
      "summaryDetail",
      "summaryProfile",
      "earningsHistory",
      "incomeStatementHistory",
      "cashflowStatementHistory",
      "earningsTrend",
      "calendarEvents",
    ].join(",");
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/market/yahoo-fundamentals.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Run full test suite + lint + typecheck**

Run: `npx vitest run && npm run lint && npx tsc --noEmit`
Expected: All clean

- [ ] **Step 8: Commit**

```bash
git add lib/market/types.ts lib/market/yahoo.ts lib/market/yahoo-fundamentals.test.ts
git commit -m "feat(earnings): extend TickerFundamentals with earningsTrend and nextEarningsDate"
```

---

### Task 2: Earnings Detail API Route

**Files:**
- Create: `app/api/market/earnings-detail/route.ts`

**Interfaces:**
- Consumes: `getTickerFundamentals(ticker: string): Promise<TickerFundamentals>` from `lib/market/yahoo`
- Consumes: `getOrFetch<T>(supabase, key, type, ttl, fetcher, options)` from `lib/cache`
- Consumes: `THESIS_TTL` (604800 seconds = 7 days) from `lib/cache/freshness`
- Produces: `GET /api/market/earnings-detail?ticker=AAPL` returns:

```typescript
{
  ticker: string;
  earningsHistory: Array<{ quarter: string; epsActual: number | null; epsEstimate: number | null; surprisePercent: number | null }>;
  earningsTrend: Array<{ period: string; epsEstimate: number | null; epsGrowth: number | null; revenueEstimate: number | null; revenueGrowth: number | null }>;
  quarterlyRevenue: Array<{ quarter: string; revenue: number | null; netIncome: number | null }>;
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextRevenueEstimate: number | null;
}
```

- [ ] **Step 1: Create the API route**

Create `app/api/market/earnings-detail/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { THESIS_TTL } from "@/lib/cache/freshness";
import { getTickerFundamentals } from "@/lib/market/yahoo";
import type { TickerFundamentals } from "@/lib/market/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticker = request.nextUrl.searchParams
      .get("ticker")
      ?.trim()
      .toUpperCase();
    if (!ticker) {
      return NextResponse.json(
        { error: "ticker parameter is required" },
        { status: 400 }
      );
    }

    const { data: fundamentals } = await getOrFetch<TickerFundamentals>(
      supabase,
      `fundamentals-${ticker}`,
      "fundamentals",
      THESIS_TTL,
      () => getTickerFundamentals(ticker),
      { shared: true }
    );

    const currentQuarter = fundamentals.earningsTrend.find(
      (e) => e.period === "0q"
    );

    return NextResponse.json({
      ticker: fundamentals.ticker,
      earningsHistory: fundamentals.earningsHistory,
      earningsTrend: fundamentals.earningsTrend,
      quarterlyRevenue: fundamentals.quarterlyRevenue,
      nextEarningsDate: fundamentals.nextEarningsDate,
      nextEpsEstimate: currentQuarter?.epsEstimate ?? null,
      nextRevenueEstimate: currentQuarter?.revenueEstimate ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch earnings detail: ${
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
Expected: All clean

- [ ] **Step 3: Commit**

```bash
git add app/api/market/earnings-detail/route.ts
git commit -m "feat(earnings): add earnings-detail API route with shared cache"
```

---

### Task 3: Earnings Tab UI + Docs

**Files:**
- Modify: `app/watchlist/ticker-detail-panel.tsx` (add Earnings tab with Recharts charts)
- Modify: `DECISIONS.md` (add Decision 53)
- Modify: `CLAUDE.md` (add new API route to key files)

**Interfaces:**
- Consumes: `GET /api/market/earnings-detail?ticker=AAPL` returning the response shape from Task 2
- Produces: Earnings tab in the detail panel with three sections: Next Earnings card, EPS Beat/Miss chart, Revenue Trend chart

- [ ] **Step 1: Add local interfaces and state for the Earnings tab**

In `app/watchlist/ticker-detail-panel.tsx`:

1. Add these local interfaces after the existing `ThesisData` interface (around line 78):

```typescript
interface EarningsTrendEntry {
  period: string;
  epsEstimate: number | null;
  epsGrowth: number | null;
  revenueEstimate: number | null;
  revenueGrowth: number | null;
}

interface EarningsHistoryEntry {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
}

interface QuarterlyRevenueEntry {
  quarter: string;
  revenue: number | null;
  netIncome: number | null;
}

interface EarningsDetailData {
  ticker: string;
  earningsHistory: EarningsHistoryEntry[];
  earningsTrend: EarningsTrendEntry[];
  quarterlyRevenue: QuarterlyRevenueEntry[];
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextRevenueEstimate: number | null;
}
```

2. Update the `Tab` type to include `"earnings"`:

```typescript
type Tab = "overview" | "news" | "sentiment" | "thesis" | "earnings";
```

3. Add state variables inside the `TickerDetailPanel` component, after the existing thesis state lines (around line 361):

```typescript
  const [earningsDetail, setEarningsDetail] = useState<EarningsDetailData | null>(null);
  const [earningsFetched, setEarningsFetched] = useState(false);
  const [earningsError, setEarningsError] = useState(false);
```

4. Add earnings reset to the ticker-change block (the `if (ticker !== prevTicker)` block). Add these three lines after `setThesisRefreshing(false);`:

```typescript
    setEarningsDetail(null);
    setEarningsFetched(false);
    setEarningsError(false);
```

5. Add derived loading state after the existing `const thesisLoading = !thesisFetched;` line:

```typescript
  const earningsLoading = !earningsFetched;
```

6. Add the Earnings tab to the `tabs` array — insert after the thesis entry:

```typescript
    { key: "earnings", label: "Earnings" },
```

- [ ] **Step 2: Add the lazy-load useEffect for earnings data**

Add this `useEffect` after the existing thesis useEffect (around line 478):

```typescript
  useEffect(() => {
    if (activeTab !== "earnings" || earningsFetched) return;

    let cancelled = false;

    fetch(`/api/market/earnings-detail?ticker=${ticker}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<EarningsDetailData>;
      })
      .then((data) => {
        if (!cancelled) {
          setEarningsDetail(data);
          setEarningsFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEarningsError(true);
          setEarningsFetched(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, activeTab, earningsFetched]);
```

- [ ] **Step 3: Add the Recharts imports**

Add `BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ComposedChart, Line, Cell` to the imports. Since the file is `"use client"`, add at the top of the file after the React import:

```typescript
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ComposedChart,
  Line,
  Cell,
} from "recharts";
```

Note: import Recharts `Tooltip` as `RechartsTooltip` to avoid shadowing any local tooltip usage.

- [ ] **Step 4: Add the Earnings tab JSX**

Add the earnings tab rendering block after the thesis tab's closing `)}` (before the final `</div>` of the component). This is the full Earnings tab content:

```tsx
      {activeTab === "earnings" && (
        <div className="flex flex-col gap-4">
          {earningsLoading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : earningsError ? (
            <p className="py-6 text-center text-xs text-zinc-400">
              Unable to load earnings data
            </p>
          ) : earningsDetail ? (
            <>
              {/* Next Earnings Card */}
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Next Earnings
                </h4>
                {earningsDetail.nextEarningsDate ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                        {new Date(earningsDetail.nextEarningsDate + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">
                        {(() => {
                          const diff = Math.ceil(
                            (new Date(earningsDetail.nextEarningsDate + "T00:00:00").getTime() - Date.now()) /
                              86400000
                          );
                          if (diff === 0) return "Today";
                          if (diff === 1) return "Tomorrow";
                          if (diff > 1) return `in ${diff} days`;
                          if (diff === -1) return "Yesterday";
                          return `${Math.abs(diff)} days ago`;
                        })()}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          Consensus EPS
                        </div>
                        <div className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                          {earningsDetail.nextEpsEstimate != null
                            ? `$${earningsDetail.nextEpsEstimate.toFixed(2)}`
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          Revenue Est.
                        </div>
                        <div className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                          {earningsDetail.nextRevenueEstimate != null
                            ? formatRevenue(earningsDetail.nextRevenueEstimate)
                            : "—"}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          EPS Growth
                        </div>
                        {(() => {
                          const nextQ = earningsDetail.earningsTrend.find(
                            (e) => e.period === "+1q"
                          );
                          if (nextQ?.epsGrowth != null) {
                            const pct = (nextQ.epsGrowth * 100).toFixed(1);
                            return (
                              <div
                                className={`text-sm font-medium tabular-nums ${
                                  nextQ.epsGrowth >= 0
                                    ? "text-emerald-500"
                                    : "text-red-500"
                                }`}
                              >
                                {nextQ.epsGrowth >= 0 ? "+" : ""}
                                {pct}%
                              </div>
                            );
                          }
                          return (
                            <div className="text-sm text-zinc-400">—</div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-zinc-400">
                    No upcoming earnings date
                  </p>
                )}
              </div>

              {/* EPS Beat/Miss Chart */}
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  EPS History — Beat / Miss
                </h4>
                {earningsDetail.earningsHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={earningsDetail.earningsHistory.map((e) => ({
                        quarter: e.quarter,
                        estimate: e.epsEstimate,
                        actual: e.epsActual,
                        surprise: e.surprisePercent,
                        beat:
                          e.epsActual != null &&
                          e.epsEstimate != null &&
                          e.epsActual >= e.epsEstimate,
                      }))}
                      margin={{ top: 20, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-zinc-200 dark:text-zinc-700"
                      />
                      <XAxis
                        dataKey="quarter"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-zinc-500"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-zinc-500"
                        tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e4e4e7",
                        }}
                        formatter={(value: number, name: string) => [
                          `$${value?.toFixed(2) ?? "—"}`,
                          name === "estimate" ? "Estimate" : "Actual",
                        ]}
                      />
                      <Bar dataKey="estimate" fill="#a1a1aa" radius={[2, 2, 0, 0]} barSize={20} name="estimate" />
                      <Bar dataKey="actual" radius={[2, 2, 0, 0]} barSize={20} name="actual">
                        {earningsDetail.earningsHistory.map((e, i) => {
                          const beat =
                            e.epsActual != null &&
                            e.epsEstimate != null &&
                            e.epsActual >= e.epsEstimate;
                          return (
                            <Cell
                              key={i}
                              fill={beat ? "#10b981" : "#ef4444"}
                            />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    No historical earnings data available
                  </p>
                )}
                {earningsDetail.earningsHistory.length > 0 && (
                  <div className="mt-2 flex justify-center gap-4 text-[10px] text-zinc-400">
                    {earningsDetail.earningsHistory.map((e) => (
                      <span key={e.quarter} className="tabular-nums">
                        {e.quarter}:{" "}
                        <span
                          className={
                            e.surprisePercent != null && e.surprisePercent >= 0
                              ? "font-medium text-emerald-500"
                              : "font-medium text-red-500"
                          }
                        >
                          {e.surprisePercent != null
                            ? `${e.surprisePercent >= 0 ? "+" : ""}${(e.surprisePercent * 100).toFixed(1)}%`
                            : "—"}
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Revenue Trend Chart */}
              <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Revenue & Net Income Trend
                </h4>
                {earningsDetail.quarterlyRevenue.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <ComposedChart
                      data={earningsDetail.quarterlyRevenue.map((q) => ({
                        quarter: q.quarter,
                        revenue: q.revenue,
                        netIncome: q.netIncome,
                      }))}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-zinc-200 dark:text-zinc-700"
                      />
                      <XAxis
                        dataKey="quarter"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-zinc-500"
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-zinc-500"
                        tickFormatter={(v: number) => {
                          if (v >= 1e9) return `$${(v / 1e9).toFixed(0)}B`;
                          if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
                          return `$${v}`;
                        }}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e4e4e7",
                        }}
                        formatter={(value: number, name: string) => [
                          value != null ? formatRevenue(value) : "—",
                          name === "revenue" ? "Revenue" : "Net Income",
                        ]}
                      />
                      <Bar
                        dataKey="revenue"
                        fill="#6366f1"
                        radius={[2, 2, 0, 0]}
                        barSize={28}
                        name="revenue"
                      />
                      <Line
                        type="monotone"
                        dataKey="netIncome"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "#10b981" }}
                        name="netIncome"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="py-4 text-center text-xs text-zinc-400">
                    No revenue data available
                  </p>
                )}
              </div>
            </>
          ) : null}
        </div>
      )}
```

- [ ] **Step 5: Run lint + typecheck**

Run: `npm run lint && npx tsc --noEmit`
Expected: All clean. If ESLint flags any issues with setState in effects or refs in render, fix using the derived-value or useEffect patterns documented in the Global Constraints.

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass (the new tab is UI-only, no new unit tests needed — the data extraction was tested in Task 1)

- [ ] **Step 7: Add Decision 53 to DECISIONS.md**

Append to `DECISIONS.md`:

```markdown
---

## Decision 53: Earnings Tab — Fundamentals Cache Reuse vs Dedicated Fetch

**Date:** Phase 8a

**Options considered:**
1. **Reuse thesis cache directly** — read the ThesisResponse from the thesis cache and extract earnings fields
2. **Separate fundamentals cache (chosen)** — cache TickerFundamentals under its own key `fundamentals-${ticker}`, shared 7-day TTL
3. **Dedicated earnings-only Yahoo fetch** — separate quoteSummary call with only earnings modules

**Decision:** Option 2 — Separate fundamentals cache

**Reasoning:** The thesis route caches the final AI-generated `ThesisResponse`, not the raw fundamentals. A separate fundamentals cache under `fundamentals-${ticker}` lets the earnings tab reuse the same raw data without depending on thesis generation. The 7-day shared TTL matches thesis since both read the same Yahoo data. Extended `getTickerFundamentals` from 7 to 9 modules (adding `earningsTrend` + `calendarEvents`) — one Yahoo request serves both thesis generation and earnings display. No AI generation needed for this tab: pure data visualization with Recharts.
```

- [ ] **Step 8: Update CLAUDE.md key files**

In `CLAUDE.md`, add this line to the Key Files section, after the thesis API route entry:

```
- `app/api/market/earnings-detail/route.ts` — earnings detail API (shared fundamentals cache, 7d TTL)
```

- [ ] **Step 9: Commit**

```bash
git add app/watchlist/ticker-detail-panel.tsx DECISIONS.md CLAUDE.md
git commit -m "feat(earnings): add Earnings tab with EPS beat/miss chart and revenue trend"
```

---

## File Structure Summary

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/market/types.ts` | Modify | Add `earningsTrend` + `nextEarningsDate` to `TickerFundamentals` |
| `lib/market/yahoo.ts` | Modify | Add 2 modules to fetch, extend `extractFundamentals` |
| `lib/market/yahoo-fundamentals.test.ts` | Modify | Test earningsTrend + nextEarningsDate extraction |
| `app/api/market/earnings-detail/route.ts` | Create | Thin projection over shared fundamentals cache |
| `app/watchlist/ticker-detail-panel.tsx` | Modify | Earnings tab: next earnings card + EPS chart + revenue chart |
| `DECISIONS.md` | Modify | Decision 53: fundamentals cache reuse |
| `CLAUDE.md` | Modify | Add API route to key files |
