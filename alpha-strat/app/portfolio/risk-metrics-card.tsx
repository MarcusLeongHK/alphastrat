"use client";

import { useState } from "react";

interface RiskMetricsCardProps {
  metrics: { beta: number; sharpe: number } | null;
  loading: boolean;
  error?: string | null;
}

function betaColor(beta: number): string {
  if (beta > 1) return "text-orange-600 dark:text-orange-400";
  if (beta < 1) return "text-sky-600 dark:text-sky-400";
  return "text-zinc-900 dark:text-zinc-100";
}

function sharpeColor(sharpe: number): string {
  if (sharpe > 1) return "text-emerald-600 dark:text-emerald-400";
  if (sharpe < 0) return "text-red-600 dark:text-red-400";
  return "text-zinc-900 dark:text-zinc-100";
}

function MetricSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <div className="h-3 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
      <div className="h-7 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
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
        className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 text-[10px] font-medium text-zinc-400 hover:text-zinc-600 dark:border-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300"
        aria-label="More info"
      >
        ?
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
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
      <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
        {tooltip && <Tooltip text={tooltip} />}
      </span>
      <span
        className={`text-2xl font-semibold tabular-nums ${
          valueClassName ?? "text-zinc-900 dark:text-zinc-100"
        }`}
      >
        {value}
      </span>
      {subtitle && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {subtitle}
        </span>
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
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Risk Metrics
      </h2>

      {loading ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <MetricSkeleton />
          <MetricSkeleton />
        </div>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : !metrics ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No data available
        </p>
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
    </div>
  );
}
