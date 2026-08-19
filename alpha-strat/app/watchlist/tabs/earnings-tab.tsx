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
  ComposedChart,
  Line,
  Cell,
} from "recharts";
import type { EarningsDetailData } from "./types";
import { formatRevenue } from "./utils";

function earningsDateRelativeLabel(dateStr: string): string {
  const diff = Math.ceil(
    (new Date(dateStr + "T00:00:00").getTime() - Date.now()) / 86400000
  );
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1) return `in ${diff} days`;
  if (diff === -1) return "Yesterday";
  return `${Math.abs(diff)} days ago`;
}

interface EarningsTabProps {
  ticker: string;
}

export function EarningsTab({ ticker }: EarningsTabProps) {
  const [earningsDetail, setEarningsDetail] = useState<EarningsDetailData | null>(null);
  const [earningsFetched, setEarningsFetched] = useState(false);
  const [earningsError, setEarningsError] = useState(false);

  const earningsLoading = !earningsFetched;

  useEffect(() => {
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
  }, [ticker]);

  return (
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
                    {earningsDateRelativeLabel(earningsDetail.nextEarningsDate)}
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
                        (e) => e.period === "0q"
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
                    formatter={(value, name) => [
                      `$${typeof value === "number" ? value.toFixed(2) : "—"}`,
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
                    formatter={(value, name) => [
                      typeof value === "number" ? formatRevenue(value) : "—",
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
  );
}
