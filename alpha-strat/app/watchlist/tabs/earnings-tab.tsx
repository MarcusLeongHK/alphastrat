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
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

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
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : earningsError ? (
        <p className="py-6 text-center text-xs text-text-tertiary">
          Unable to load earnings data
        </p>
      ) : earningsDetail ? (
        <>
          {/* Next Earnings Card */}
          <Card padding="p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Next Earnings
            </h4>
            {earningsDetail.nextEarningsDate ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-bold text-text-primary">
                    {new Date(earningsDetail.nextEarningsDate + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {earningsDateRelativeLabel(earningsDetail.nextEarningsDate)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="text-[10px] text-text-tertiary">
                      Consensus EPS
                    </div>
                    <div className="text-sm font-medium tabular-nums text-text-primary">
                      {earningsDetail.nextEpsEstimate != null
                        ? `$${earningsDetail.nextEpsEstimate.toFixed(2)}`
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-tertiary">
                      Revenue Est.
                    </div>
                    <div className="text-sm font-medium tabular-nums text-text-primary">
                      {earningsDetail.nextRevenueEstimate != null
                        ? formatRevenue(earningsDetail.nextRevenueEstimate)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-text-tertiary">
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
                                ? "text-success"
                                : "text-danger"
                            }`}
                          >
                            {nextQ.epsGrowth >= 0 ? "+" : ""}
                            {pct}%
                          </div>
                        );
                      }
                      return (
                        <div className="text-sm text-text-tertiary">—</div>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-text-tertiary">
                No upcoming earnings date
              </p>
            )}
          </Card>

          {/* EPS Beat/Miss Chart */}
          <Card padding="p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
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
                    className="text-border-primary"
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-text-secondary"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-text-secondary"
                    tickFormatter={(v: number) => `$${v.toFixed(2)}`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      fontSize: 12,
                      borderRadius: 8,
                      border: "1px solid var(--border-primary)",
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                    }}
                    formatter={(value, name) => [
                      `$${typeof value === "number" ? value.toFixed(2) : "—"}`,
                      name === "estimate" ? "Estimate" : "Actual",
                    ]}
                  />
                  <Bar dataKey="estimate" fill="var(--border-secondary)" radius={[2, 2, 0, 0]} barSize={20} name="estimate" />
                  <Bar dataKey="actual" radius={[2, 2, 0, 0]} barSize={20} name="actual">
                    {earningsDetail.earningsHistory.map((e, i) => {
                      const beat =
                        e.epsActual != null &&
                        e.epsEstimate != null &&
                        e.epsActual >= e.epsEstimate;
                      return (
                        <Cell
                          key={i}
                          fill={beat ? "var(--success)" : "var(--danger)"}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-4 text-center text-xs text-text-tertiary">
                No historical earnings data available
              </p>
            )}
            {earningsDetail.earningsHistory.length > 0 && (
              <div className="mt-2 flex justify-center gap-4 text-[10px] text-text-tertiary">
                {earningsDetail.earningsHistory.map((e) => (
                  <span key={e.quarter} className="tabular-nums">
                    {e.quarter}:{" "}
                    <span
                      className={
                        e.surprisePercent != null && e.surprisePercent >= 0
                          ? "font-medium text-success"
                          : "font-medium text-danger"
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
          </Card>

          {/* Revenue Trend Chart */}
          <Card padding="p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
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
                    className="text-border-primary"
                  />
                  <XAxis
                    dataKey="quarter"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-text-secondary"
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    className="text-text-secondary"
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
                      border: "1px solid var(--border-primary)",
                      background: "var(--surface-primary)",
                      color: "var(--text-primary)",
                    }}
                    formatter={(value, name) => [
                      typeof value === "number" ? formatRevenue(value) : "—",
                      name === "revenue" ? "Revenue" : "Net Income",
                    ]}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="var(--accent)"
                    radius={[2, 2, 0, 0]}
                    barSize={28}
                    name="revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="netIncome"
                    stroke="var(--success)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: "var(--success)" }}
                    name="netIncome"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-4 text-center text-xs text-text-tertiary">
                No revenue data available
              </p>
            )}
          </Card>
        </>
      ) : null}
    </div>
  );
}
