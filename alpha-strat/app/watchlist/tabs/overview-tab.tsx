"use client";

import type { AnalystData, EarningsData, QuoteData } from "@/lib/market/types";
import { formatUsd, formatRevenue, ratingColor, formatRating } from "./utils";
import { Card } from "@/app/components/ui/card";

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function AnalystMeter({ mean }: { mean: number }) {
  const position = ((mean - 1) / 4) * 100;
  const labels = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-success via-warning to-danger">
        <div
          className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-full bg-white shadow ring-1 ring-black/20"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-text-tertiary">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

interface OverviewTabProps {
  quote: QuoteData | undefined;
  analyst: AnalystData | undefined;
  earning: EarningsData | undefined;
}

export function OverviewTab({ quote, analyst, earning }: OverviewTabProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Analyst Ratings */}
      <Card className="p-3">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Analyst Consensus
        </h4>
        {analyst?.recommendationKey ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span
                className={`text-lg font-bold ${ratingColor(analyst.recommendationKey)}`}
              >
                {formatRating(analyst.recommendationKey)}
              </span>
              <span className="text-xs text-text-secondary">
                {analyst.numberOfAnalysts} analysts
              </span>
            </div>
            {analyst.recommendationMean != null && (
              <AnalystMeter mean={analyst.recommendationMean} />
            )}
            {analyst.targetMeanPrice != null && (
              <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] text-text-tertiary">
                    Low
                  </div>
                  <div className="text-sm font-medium tabular-nums text-text-primary">
                    ${formatUsd(analyst.targetLowPrice ?? 0)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary">
                    Mean Target
                  </div>
                  <div className="text-sm font-bold tabular-nums text-text-primary">
                    ${formatUsd(analyst.targetMeanPrice)}
                  </div>
                  {quote && (
                    <div
                      className={`text-[10px] font-medium ${
                        analyst.targetMeanPrice > quote.price
                          ? "text-success"
                          : "text-danger"
                      }`}
                    >
                      {analyst.targetMeanPrice > quote.price ? "+" : ""}
                      {(
                        ((analyst.targetMeanPrice - quote.price) /
                          quote.price) *
                        100
                      ).toFixed(1)}
                      % upside
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[10px] text-text-tertiary">
                    High
                  </div>
                  <div className="text-sm font-medium tabular-nums text-text-primary">
                    ${formatUsd(analyst.targetHighPrice ?? 0)}
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">No analyst data available</p>
        )}
      </Card>

      {/* Earnings Info */}
      <Card className="p-3">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Next Earnings
        </h4>
        {earning?.earningsDate ? (
          <div className="flex flex-col gap-2">
            <div className="text-lg font-bold text-text-primary">
              {new Date(earning.earningsDate).toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[10px] text-text-tertiary">
                  EPS Estimate
                </div>
                <div className="text-sm font-medium tabular-nums text-text-primary">
                  {earning.epsEstimate != null
                    ? `$${earning.epsEstimate.toFixed(2)}`
                    : "—"}
                </div>
                {earning.epsLow != null && earning.epsHigh != null && (
                  <div className="text-[10px] tabular-nums text-text-tertiary">
                    Range: ${earning.epsLow.toFixed(2)} – $
                    {earning.epsHigh.toFixed(2)}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[10px] text-text-tertiary">
                  Revenue Estimate
                </div>
                <div className="text-sm font-medium tabular-nums text-text-primary">
                  {earning.revenueEstimate != null
                    ? formatRevenue(earning.revenueEstimate)
                    : "—"}
                </div>
                {earning.revenueLow != null &&
                  earning.revenueHigh != null && (
                    <div className="text-[10px] tabular-nums text-text-tertiary">
                      Range: {formatRevenue(earning.revenueLow)} –{" "}
                      {formatRevenue(earning.revenueHigh)}
                    </div>
                  )}
              </div>
            </div>
            {earning.marketCap != null && (
              <div className="mt-1">
                <span className="text-[10px] text-text-tertiary">
                  Market Cap:{" "}
                </span>
                <span className="text-xs font-medium text-text-primary">
                  {formatMarketCap(earning.marketCap)}
                </span>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">No earnings date available</p>
        )}
      </Card>
    </div>
  );
}
