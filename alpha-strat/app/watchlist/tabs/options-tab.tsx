"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Line,
  LineChart,
  Legend,
  ReferenceLine,
} from "recharts";
import type { OptionsAnalysisData } from "./types";
import { formatUsd } from "./utils";

function formatIvPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function skewColor(direction: string): string {
  if (direction === "put-heavy") return "text-red-500";
  if (direction === "call-heavy") return "text-emerald-500";
  return "text-zinc-400";
}

const OPTIONS_ANALYSIS_SECTIONS: {
  key: keyof OptionsAnalysisData["analysis"];
  label: string;
  icon: string;
  accent: string;
}[] = [
  { key: "marketPositioning", label: "Market Positioning", icon: "M3 4h18M3 8h18M3 12h14M3 16h10", accent: "from-blue-500/20 to-blue-500/5 dark:from-blue-500/10 dark:to-blue-500/0" },
  { key: "expectedMoveAnalysis", label: "Expected Move", icon: "M13 7l5 5-5 5M6 12h12", accent: "from-violet-500/20 to-violet-500/5 dark:from-violet-500/10 dark:to-violet-500/0" },
  { key: "volatilityAssessment", label: "Volatility", icon: "M3 12l3-3 4 6 4-8 4 6 3-3", accent: "from-amber-500/20 to-amber-500/5 dark:from-amber-500/10 dark:to-amber-500/0" },
  { key: "notableFlow", label: "Notable Flow", icon: "M12 8c-2.2 0-4 1.8-4 4s1.8 4 4 4 4-1.8 4-4-1.8-4-4-4zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41", accent: "from-emerald-500/20 to-emerald-500/5 dark:from-emerald-500/10 dark:to-emerald-500/0" },
  { key: "keyRisksAndCatalysts", label: "Risks & Catalysts", icon: "M12 9v4m0 4h.01M12 2L2 22h20L12 2z", accent: "from-red-500/20 to-red-500/5 dark:from-red-500/10 dark:to-red-500/0" },
  { key: "actionableTakeaway", label: "Takeaway", icon: "M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z", accent: "from-cyan-500/20 to-cyan-500/5 dark:from-cyan-500/10 dark:to-cyan-500/0" },
];

function AnalysisDisclosure({
  label,
  text,
  icon,
  accent,
}: {
  label: string;
  text: string;
  icon: string;
  accent: string;
}) {
  return (
    <details
      open
      className={`group overflow-hidden rounded-lg border border-zinc-200 bg-gradient-to-r ${accent} dark:border-zinc-800`}
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3">
        <svg
          className="h-4 w-4 shrink-0 text-zinc-500 dark:text-zinc-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d={icon} />
        </svg>
        <span className="flex-1 text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
          {label}
        </span>
        <svg
          className="h-3.5 w-3.5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <p className="px-4 pb-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {text}
      </p>
    </details>
  );
}

interface OptionsTabProps {
  ticker: string;
}

export function OptionsTab({ ticker }: OptionsTabProps) {
  const [optionsData, setOptionsData] = useState<OptionsAnalysisData | null>(null);
  const [optionsFetched, setOptionsFetched] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const optionsLoading = !optionsFetched;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/market/options-analysis?ticker=${encodeURIComponent(ticker)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<OptionsAnalysisData>;
      })
      .then((data) => {
        if (!cancelled) {
          setOptionsData(data);
          setOptionsFetched(true);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setOptionsError(err instanceof Error ? err.message : String(err));
          setOptionsFetched(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <div className="flex flex-col gap-4">
      {optionsLoading ? (
        <div className="flex flex-col gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
            />
          ))}
        </div>
      ) : optionsError ? (
        <p className="py-6 text-center text-xs text-zinc-400">
          Unable to load options data: {optionsError}
        </p>
      ) : optionsData ? (
        <>
          {/* Section A: Sentiment Summary + AI Analysis */}
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/80">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <div className={`h-2.5 w-2.5 rounded-full ${
                  optionsData.putCallRatio < 0.7
                    ? "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
                    : optionsData.putCallRatio > 1.0
                      ? "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]"
                      : "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
                }`} />
                <span className={`text-sm font-semibold ${
                  optionsData.putCallRatio < 0.7
                    ? "text-emerald-600 dark:text-emerald-400"
                    : optionsData.putCallRatio > 1.0
                      ? "text-red-600 dark:text-red-400"
                      : "text-amber-600 dark:text-amber-400"
                }`}>
                  {optionsData.putCallRatio < 0.7
                    ? "Bullish Flow"
                    : optionsData.putCallRatio > 1.0
                      ? "Bearish Flow"
                      : "Neutral Flow"}
                </span>
              </div>
              <span className="text-xs text-zinc-400">|</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                P/C {optionsData.putCallRatio.toFixed(2)} &middot; IV {formatIvPct(optionsData.signals.atmIv)} &middot; HV {formatIvPct(optionsData.signals.historicalVolatility)}
              </span>
            </div>
            <h4 className="mb-1 text-[10px] font-medium uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
              Options Market Analysis
            </h4>
          </div>
          <div className="flex flex-col gap-2">
            {OPTIONS_ANALYSIS_SECTIONS.map((section) => (
              <AnalysisDisclosure
                key={section.key}
                label={section.label}
                text={optionsData.analysis[section.key]}
                icon={section.icon}
                accent={section.accent}
              />
            ))}
          </div>

          {/* Section B: Expected Move Gauge */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Expected Move
            </h4>
            <p className="mb-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              The price range the options market expects for the nearest expiry, derived from the ATM straddle price. The solid line is the current price; the shaded band is the expected range. The dashed line marks max pain — the strike where option sellers lose the least.
            </p>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                ${formatUsd(optionsData.underlyingPrice)}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                &plusmn;${formatUsd(optionsData.expectedMove.dollars)} (
                {optionsData.expectedMove.percent.toFixed(1)}%)
              </span>
            </div>
            {(() => {
              const { lowerBound, upperBound } = optionsData.expectedMove;
              const spot = optionsData.underlyingPrice;
              const maxPain = optionsData.maxPain;
              const rangeLow = Math.min(lowerBound, maxPain, spot) * 0.98;
              const rangeHigh = Math.max(upperBound, maxPain, spot) * 1.02;
              const span = rangeHigh - rangeLow || 1;
              const pct = (v: number) =>
                Math.min(100, Math.max(0, ((v - rangeLow) / span) * 100));
              return (
                <div className="relative h-8 w-full">
                  <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                  <div
                    className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-blue-400/40 dark:bg-blue-500/30"
                    style={{
                      left: `${pct(lowerBound)}%`,
                      width: `${pct(upperBound) - pct(lowerBound)}%`,
                    }}
                  />
                  <div
                    className="absolute top-0 h-8 w-0.5 bg-zinc-900 dark:bg-zinc-100"
                    style={{ left: `${pct(spot)}%` }}
                    title={`Current: $${formatUsd(spot)}`}
                  />
                  <div
                    className="absolute top-0 h-8 w-0.5 border-l border-dashed border-amber-500"
                    style={{ left: `${pct(maxPain)}%` }}
                    title={`Max Pain: $${formatUsd(maxPain)}`}
                  />
                </div>
              );
            })()}
            <div className="mt-1 flex justify-between text-[10px] tabular-nums text-zinc-400 dark:text-zinc-500">
              <span>${formatUsd(optionsData.expectedMove.lowerBound)}</span>
              <span className="text-amber-500">
                Max Pain ${formatUsd(optionsData.maxPain)}
              </span>
              <span>${formatUsd(optionsData.expectedMove.upperBound)}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <div className="text-center">
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Put/Call Ratio
                </div>
                <div className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {optionsData.putCallRatio.toFixed(2)}
                </div>
                <div className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-600">
                  {optionsData.putCallRatio < 0.7 ? "Bullish (<0.7)" : optionsData.putCallRatio > 1.0 ? "Bearish (>1.0)" : "Neutral"}
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  ATM IV
                </div>
                <div className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                  {formatIvPct(optionsData.signals.atmIv)}
                </div>
                <div className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-600">
                  vs {formatIvPct(optionsData.signals.historicalVolatility)} realized
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  IV Skew
                </div>
                <div
                  className={`text-sm font-medium ${skewColor(optionsData.signals.ivSkew.direction)}`}
                >
                  {optionsData.signals.ivSkew.direction}
                </div>
                <div className="mt-0.5 text-[9px] text-zinc-400 dark:text-zinc-600">
                  {optionsData.signals.ivSkew.direction === "put-heavy" ? "Downside protection bid" : optionsData.signals.ivSkew.direction === "call-heavy" ? "Upside demand bid" : "Balanced demand"}
                </div>
              </div>
            </div>
          </div>

          {/* Section C: IV Surface Chart */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              IV Surface by Moneyness
            </h4>
            <p className="mb-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              Implied volatility across strike prices for each expiry. The x-axis shows how far a strike is from the current price (negative = below, positive = above). A &ldquo;smile&rdquo; shape means the market prices higher volatility for large moves in either direction. Steeper on the left suggests more demand for downside protection.
            </p>
            {optionsData.ivSurface.length > 0 ? (
              (() => {
                const expiries = Array.from(
                  new Set(optionsData.ivSurface.map((p) => p.expiry))
                ).sort();
                const moneynessValues = Array.from(
                  new Set(optionsData.ivSurface.map((p) => p.moneyness))
                ).sort((a, b) => a - b);
                const chartData = moneynessValues.map((moneyness) => {
                  const row: Record<string, number> = { moneyness };
                  for (const point of optionsData.ivSurface) {
                    if (point.moneyness === moneyness) {
                      row[point.expiry] = point.iv * 100;
                    }
                  }
                  return row;
                });
                const palette = [
                  "#6366f1",
                  "#10b981",
                  "#f59e0b",
                  "#ef4444",
                  "#8b5cf6",
                  "#06b6d4",
                ];
                return (
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="currentColor"
                        className="text-zinc-200 dark:text-zinc-700"
                      />
                      <XAxis
                        dataKey="moneyness"
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-zinc-500"
                        tickFormatter={(v: number) => `${v > 0 ? "+" : ""}${v}%`}
                      />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        className="text-zinc-500"
                        tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                      />
                      <RechartsTooltip
                        contentStyle={{
                          fontSize: 12,
                          borderRadius: 8,
                          border: "1px solid #e4e4e7",
                        }}
                        formatter={(value) => [
                          typeof value === "number" ? `${value.toFixed(1)}%` : "—",
                          "IV",
                        ]}
                        labelFormatter={(label) => `Moneyness: ${label}%`}
                      />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      {expiries.map((expiry, i) => (
                        <Line
                          key={expiry}
                          type="monotone"
                          dataKey={expiry}
                          stroke={palette[i % palette.length]}
                          strokeWidth={2}
                          dot={{ r: 2 }}
                          connectNulls
                          name={expiry}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                );
              })()
            ) : (
              <p className="py-4 text-center text-xs text-zinc-400">
                No IV surface data available
              </p>
            )}
          </div>

          {/* Section D: IV Term Structure */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              IV Term Structure
            </h4>
            <p className="mb-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              How implied volatility changes across expiry dates. A rising curve (contango) is normal — longer time horizons carry more uncertainty. A falling or kinked curve signals the market expects a near-term event (e.g. earnings) to cause outsized moves.
            </p>
            {optionsData.ivTermStructure.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart
                  data={optionsData.ivTermStructure.map((t) => ({
                    expiry: t.expiry,
                    atmIv: t.atmIv * 100,
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
                    dataKey="expiry"
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
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e4e4e7",
                    }}
                    formatter={(value) => [
                      typeof value === "number" ? `${value.toFixed(1)}%` : "—",
                      "ATM IV",
                    ]}
                  />
                  <Line
                    type="monotone"
                    dataKey="atmIv"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "#6366f1" }}
                    name="atmIv"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-4 text-center text-xs text-zinc-400">
                No term structure data available
              </p>
            )}
          </div>

          {/* Section E: Positioning by Strike */}
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Positioning by Strike
            </h4>
            <p className="mb-3 text-[11px] leading-relaxed text-zinc-400 dark:text-zinc-500">
              Trading volume by strike price for the nearest expiry. Green bars are call (bullish) volume, red bars are put (bearish) volume. Tall bars indicate strikes where traders are concentrating bets. The dashed line marks max pain — the price at which the most options expire worthless.
            </p>
            {optionsData.positioning.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={optionsData.positioning.map((p) => ({
                    strike: p.strike,
                    callVolume: p.callVolume,
                    putVolume: p.putVolume,
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
                    dataKey="strike"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-zinc-500"
                    tickFormatter={(v: number) => `$${v}`}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-zinc-500"
                  />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid #e4e4e7",
                    }}
                    formatter={(value, name) => [
                      typeof value === "number" ? value.toLocaleString() : "—",
                      name === "callVolume" ? "Call Volume" : "Put Volume",
                    ]}
                    labelFormatter={(label) => `Strike: $${label}`}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <ReferenceLine
                    x={optionsData.maxPain}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{
                      value: "Max Pain",
                      position: "top",
                      fontSize: 10,
                      fill: "#f59e0b",
                    }}
                  />
                  <Bar dataKey="callVolume" fill="#10b981" radius={[2, 2, 0, 0]} name="callVolume" />
                  <Bar dataKey="putVolume" fill="#ef4444" radius={[2, 2, 0, 0]} name="putVolume" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-4 text-center text-xs text-zinc-400">
                No positioning data available
              </p>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
