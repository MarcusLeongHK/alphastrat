"use client";

import { useEffect, useMemo, useState } from "react";
import type { Position } from "@/lib/types";
import type { QuoteData } from "@/lib/market/types";
import { calcPnLPercent } from "@/lib/finance/pnl";
import { calcWeights } from "@/lib/finance/allocation";
import { PositionsTable } from "./positions-table";
import { AllocationChart } from "./allocation-chart";
import { RiskMetricsCard } from "./risk-metrics-card";
import { PerformanceChart } from "./performance-chart";

interface RiskMetrics {
  beta: number;
  sharpe: number;
}

export function PortfolioDashboard({ positions }: { positions: Position[] }) {
  const [quotes, setQuotes] = useState<QuoteData[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [metrics, setMetrics] = useState<RiskMetrics | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);


  const tickers = useMemo(
    () => Array.from(new Set(positions.map((p) => p.ticker))),
    [positions]
  );

  // Loading flags are derived from the request lifecycle rather than set
  // directly inside effects, so no cascading synchronous setState calls.
  const loading = tickers.length > 0 && quotes === null && error === null;

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    fetch(`/api/market/quote?tickers=${tickers.join(",")}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch quotes");
        }
        return res.json() as Promise<QuoteData[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setQuotes(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch quotes"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tickers]);

  const metricsLoading =
    !!quotes && quotes.length > 0 && metrics === null && metricsError === null;

  useEffect(() => {
    if (!quotes || quotes.length === 0) return;

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


  if (positions.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No positions yet. Add one above to get started.
      </p>
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
    <div className="flex flex-col gap-8">
      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Allocation
          </h3>
          <div className="mt-3">
            {loading ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Loading allocation…
              </p>
            ) : (
              <AllocationChart data={allocationData} />
            )}
          </div>
        </div>

        <RiskMetricsCard
          metrics={metrics}
          loading={metricsLoading}
          error={metricsError}
        />
      </div>

    </div>
  );
}
