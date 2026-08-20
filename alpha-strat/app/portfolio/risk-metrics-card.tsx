"use client";

import { useState } from "react";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

interface RiskMetricsCardProps {
  metrics: { beta: number; sharpe: number } | null;
  loading: boolean;
  error?: string | null;
}

function betaColor(beta: number): string {
  if (beta > 1) return "text-warning";
  if (beta < 1) return "text-accent";
  return "text-text-primary";
}

function sharpeColor(sharpe: number): string {
  if (sharpe > 1) return "text-success";
  if (sharpe < 0) return "text-danger";
  return "text-text-primary";
}

function MetricSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-7 w-20" />
    </div>
  );
}

function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow((v) => !v)}
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-border-secondary text-[10px] font-medium text-text-tertiary hover:text-text-secondary"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-border-primary bg-surface-primary p-3 text-xs leading-relaxed text-text-secondary shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

function Metric({
  label,
  value,
  valueClassName,
  subtitle,
  tooltip,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  subtitle?: string;
  tooltip?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span
        className={`text-2xl font-semibold tabular-nums ${
          valueClassName ?? "text-text-primary"
        }`}
      >
        {value}
      </span>
      {subtitle && (
        <span className="text-xs text-text-tertiary">{subtitle}</span>
      )}
    </div>
  );
}

export function RiskMetricsCard({
  metrics,
  loading,
  error,
}: RiskMetricsCardProps) {
  return (
    <Card>
      <h2 className="mb-4 text-sm font-semibold text-text-primary">
        Risk Metrics
      </h2>

      {loading ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !metrics ? (
        <p className="text-sm text-text-secondary">No data available</p>
      ) : (
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <Metric
            label="Beta"
            value={metrics.beta.toFixed(2)}
            valueClassName={betaColor(metrics.beta)}
            subtitle="vs S&P 500"
            tooltip="Measures how much your portfolio moves relative to the S&P 500. Beta > 1 means more volatile than the market, < 1 means less volatile. A beta of 1.5 means your portfolio tends to move 50% more than the market."
          />
          <Metric
            label="Sharpe Ratio"
            value={metrics.sharpe.toFixed(2)}
            valueClassName={sharpeColor(metrics.sharpe)}
            tooltip="Measures risk-adjusted return — how much return you get per unit of risk. Higher is better. Above 1 is good, above 2 is very good. Calculated using a 5% annual risk-free rate."
          />
        </div>
      )}
    </Card>
  );
}
