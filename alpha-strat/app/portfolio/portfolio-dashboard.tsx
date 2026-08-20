"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Position } from "@/lib/types";
import type { QuoteData } from "@/lib/market/types";
import { calcPnLPercent } from "@/lib/finance/pnl";
import { calcWeights } from "@/lib/finance/allocation";
import { PositionsTable } from "./positions-table";
import { AllocationChart } from "./allocation-chart";
import { RiskMetricsCard } from "./risk-metrics-card";
import { PerformanceChart } from "./performance-chart";
import { AiSummaryCard } from "./ai-summary-card";
import { Card } from "@/app/components/ui/card";
import { EmptyState } from "@/app/components/ui/empty-state";
import { Skeleton } from "@/app/components/ui/skeleton";

interface RiskMetrics {
  beta: number;
  sharpe: number;
}

const QUOTE_POLL_INTERVAL_MS = 60_000;

function RefreshIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`}
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export function PortfolioDashboard({ positions }: { positions: Position[] }) {
  const [quotes, setQuotes] = useState<QuoteData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);


  const tickers = useMemo(
    () => Array.from(new Set(positions.map((p) => p.ticker))),
    [positions]
  );

  // Loading flags are derived from the request lifecycle rather than set
  // directly inside effects, so no cascading synchronous setState calls.
  const loading = tickers.length > 0 && quotes === null && error === null;

  const fetchQuotes = useCallback(
    async (tickerList: string[], { silent }: { silent?: boolean } = {}) => {
      if (tickerList.length === 0) return;

      if (!silent) setRefreshing(true);

      try {
        const res = await fetch(
          `/api/market/quote?tickers=${tickerList.join(",")}`
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch quotes");
        }
        const data = (await res.json()) as QuoteData[];
        setQuotes(data);
        setError(null);
        setLastUpdated(new Date());
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to fetch quotes"
        );
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  // Initial fetch whenever the set of tickers changes. Uses `silent: true`
  // so no state is set synchronously within the effect body (the existing
  // `loading` skeleton already covers this case).
  // fetchQuotes only sets state inside its async continuation (after
  // `await fetch`), never synchronously during this call.
  useEffect(() => {
    if (tickers.length === 0) return;
    fetchQuotes(tickers, { silent: true }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [tickers, fetchQuotes]);

  // Poll for fresh quotes every 60s, but only while the tab is visible.
  // Risk metrics and the AI summary are deliberately NOT re-run here —
  // they only depend on `quotes` changing, and re-triggering the AI call
  // on every poll would be expensive for no real benefit.
  useEffect(() => {
    if (tickers.length === 0) return;

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") {
        fetchQuotes(tickers, { silent: true });
      }
    }, QUOTE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [tickers, fetchQuotes]);

  // Tick the "Updated Xs ago" label once per second.
  useEffect(() => {
    if (!lastUpdated) return;

    const tick = () => {
      setSecondsAgo(
        Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))
      );
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const handleManualRefresh = () => {
    if (tickers.length === 0) return;
    fetchQuotes(tickers);
  };

  const metricsLoading =
    !!quotes && quotes.length > 0 && metrics === null && metricsError === null;


  // Risk metrics only need to be computed once per ticker set — they don't
  // depend on the latest quote prices, so a quote poll shouldn't re-trigger
  // this (potentially costly) fetch. `metricsFetchedForRef` tracks the
  // ticker signature we've already fetched metrics for.
  const metricsFetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!quotes || quotes.length === 0) return;

    const tickerKey = tickers.join(",");
    if (metricsFetchedForRef.current === tickerKey) return;
    metricsFetchedForRef.current = tickerKey;

    let cancelled = false;

    fetch(`/api/analysis/risk-metrics?tickers=${tickers.join(",")}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch risk metrics");
        }
        return res.json() as Promise<{ metrics: RiskMetrics }>;
      })
      .then((data) => {
        if (!cancelled) {
          setMetrics(data.metrics);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setMetricsError(
            err instanceof Error ? err.message : "Failed to fetch risk metrics"
          );
        }
      });

    return () => {
      cancelled = true;
      metricsFetchedForRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes]);

  const enrichedPositions = useMemo(() => {
    if (!quotes) return null;

    const priceByTicker = new Map(quotes.map((q) => [q.ticker, q.price]));

    return positions
      .map((p) => {
        const currentPrice = priceByTicker.get(p.ticker);
        if (currentPrice === undefined) return null;
        return {
          ticker: p.ticker,
          quantity: p.quantity,
          costBasis: p.cost_basis,
          currentPrice,
          pnlPercent: calcPnLPercent(p.cost_basis, currentPrice),
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null);
  }, [positions, quotes]);

  const weights = useMemo(() => {
    if (!enrichedPositions) return [];
    return calcWeights(
      enrichedPositions.map((p) => ({
        ticker: p.ticker,
        quantity: p.quantity,
        currentPrice: p.currentPrice,
      }))
    );
  }, [enrichedPositions]);

  const aiLoading =
    !!metrics && !!enrichedPositions && enrichedPositions.length > 0 && aiSummary === null && aiError === null;

  // Same idea as risk metrics: only generate the AI summary once per ticker
  // set. It's an expensive LLM call and shouldn't re-run just because a
  // quote poll produced a new `enrichedPositions` reference.
  const aiFetchedForRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enrichedPositions || enrichedPositions.length === 0 || !metrics) return;

    const tickerKey = tickers.join(",");
    if (aiFetchedForRef.current === tickerKey) return;
    aiFetchedForRef.current = tickerKey;

    let cancelled = false;

    fetch("/api/analysis/ai-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positions: enrichedPositions.map((p, i) => ({
          ...p,
          weight: weights[i]?.weight ?? 0,
        })),
        metrics: { ...metrics, cagr: 0 },
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to generate AI summary");
        }
        return res.json() as Promise<{ summary: string }>;
      })
      .then((data) => {
        if (!cancelled) {
          setAiSummary(data.summary);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setAiError(
            err instanceof Error ? err.message : "Failed to generate AI summary"
          );
        }
      });

    return () => {
      cancelled = true;
      aiFetchedForRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrichedPositions, metrics]);

  if (positions.length === 0) {
    return (
      <EmptyState
        title="No positions yet"
        description="Add a position above to start tracking your portfolio."
      />
    );
  }

  const allocationData = enrichedPositions
    ? weights.map((w) => ({
        ticker: w.ticker,
        weight: w.weight,
        marketValue: w.marketValue,
      }))
    : [];

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <div className="flex items-center gap-2 text-xs text-text-secondary">
        {lastUpdated && <span>Updated {secondsAgo}s ago</span>}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="rounded p-1 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary disabled:opacity-50"
          title="Refresh quotes"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {positions.length > 0 && (
        <PerformanceChart
          positions={positions.map((p) => ({
            ticker: p.ticker,
            quantity: p.quantity,
          }))}
        />
      )}

      <div>
        <PositionsTable positions={positions} quotes={quotes} />
      </div>

      <AiSummaryCard summary={aiSummary} loading={aiLoading} error={aiError} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h3 className="text-sm font-medium text-text-primary">
            Allocation
          </h3>
          <div className="mt-3">
            {loading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <AllocationChart data={allocationData} />
            )}
          </div>
        </Card>

        <RiskMetricsCard
          metrics={metrics}
          loading={metricsLoading}
          error={metricsError}
        />
      </div>

    </div>
  );
}
