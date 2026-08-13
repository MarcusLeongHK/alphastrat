"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import type { WatchlistItem } from "@/lib/types";
import type { QuoteData, EarningsData, AnalystData } from "@/lib/market/types";
import { removeFromWatchlist, type ActionResult } from "./actions";
import { TickerDetailPanel } from "./ticker-detail-panel";

const initialState: ActionResult = {};

function DeleteButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(
    removeFromWatchlist,
    initialState
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
      >
        {isPending ? "..." : "Remove"}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-red-500">{state.error}</span>
      )}
    </form>
  );
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function changeColor(value: number): string {
  if (value > 0) return "text-emerald-500";
  if (value < 0) return "text-red-500";
  return "text-zinc-700 dark:text-zinc-300";
}

function formatEarningsDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatRating(key: string): string {
  const labels: Record<string, string> = {
    strong_buy: "Strong Buy",
    buy: "Buy",
    hold: "Hold",
    underperform: "Underperform",
    sell: "Sell",
  };
  return labels[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

function ratingColor(key: string | null | undefined): string {
  if (!key) return "text-zinc-700 dark:text-zinc-300";
  if (key === "strong_buy" || key === "buy") return "text-emerald-500";
  if (key === "hold") return "text-amber-500";
  return "text-red-500";
}

function isWithinDays(dateStr: string, days: number): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= days;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function formatRevenue(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  return `$${value.toLocaleString()}`;
}

function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function countdownLabel(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return `${Math.abs(days)}d ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days}d`;
}

function countdownColor(dateStr: string): string {
  const days = daysUntil(dateStr);
  if (days < 0) return "text-zinc-400 dark:text-zinc-500";
  if (days <= 3) return "text-red-500";
  if (days <= 7) return "text-amber-500";
  return "text-blue-500 dark:text-blue-400";
}

function EarningsCalendar({
  earnings,
  quotes,
}: {
  earnings: EarningsData[];
  quotes: QuoteData[] | null;
}) {
  const withDates = earnings
    .filter((e) => e.earningsDate !== null)
    .sort((a, b) => a.earningsDate!.localeCompare(b.earningsDate!));

  if (withDates.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No upcoming earnings dates available.
      </p>
    );
  }

  const quoteMap = new Map((quotes ?? []).map((q) => [q.ticker, q]));

  const grouped = new Map<string, EarningsData[]>();
  for (const e of withDates) {
    const key = e.earningsDate!;
    const list = grouped.get(key) ?? [];
    list.push(e);
    grouped.set(key, list);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(grouped.entries()).map(([date, items]) => (
        <div key={date}>
          <div className="mb-2 flex items-center gap-3">
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {formatEarningsDate(date)}
            </span>
            <span
              className={`text-xs font-medium ${countdownColor(date)}`}
            >
              {countdownLabel(date)}
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <th className="px-3 py-2 text-left font-medium text-zinc-500 dark:text-zinc-400">
                    Ticker
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Price
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Mkt Cap
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    EPS Est.
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    EPS Range
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Rev Est.
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-zinc-500 dark:text-zinc-400">
                    Rev Range
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((e) => {
                  const quote = quoteMap.get(e.ticker);
                  return (
                    <tr
                      key={e.ticker}
                      className="border-b border-zinc-100 last:border-b-0 dark:border-zinc-800/50"
                    >
                      <td className="px-3 py-2.5 font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                        {e.ticker}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {quote ? `$${quote.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {e.marketCap != null
                          ? formatMarketCap(e.marketCap)
                          : quote?.marketCap != null
                            ? formatMarketCap(quote.marketCap)
                            : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                        {e.epsEstimate != null
                          ? `$${e.epsEstimate.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {e.epsLow != null && e.epsHigh != null
                          ? `$${e.epsLow.toFixed(2)} – $${e.epsHigh.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-zinc-900 dark:text-zinc-100">
                        {e.revenueEstimate != null
                          ? formatRevenue(e.revenueEstimate)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {e.revenueLow != null && e.revenueHigh != null
                          ? `${formatRevenue(e.revenueLow)} – ${formatRevenue(e.revenueHigh)}`
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

interface WatchlistDashboardProps {
  items: WatchlistItem[];
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

export function WatchlistDashboard({ items }: WatchlistDashboardProps) {
  const [quotes, setQuotes] = useState<QuoteData[] | null>(null);
  const [quotesError, setQuotesError] = useState<string | null>(null);
  const [earnings, setEarnings] = useState<EarningsData[] | null>(null);
  const [earningsError, setEarningsError] = useState<string | null>(null);
  const [analysts, setAnalysts] = useState<AnalystData[] | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);

  const tickers = useMemo(
    () => Array.from(new Set(items.map((i) => i.ticker))),
    [items]
  );

  const loading =
    tickers.length > 0 && quotes === null && quotesError === null;

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
        setQuotesError(null);
        setLastUpdated(new Date());
      } catch (err) {
        setQuotesError(
          err instanceof Error ? err.message : "Failed to fetch quotes"
        );
      } finally {
        setRefreshing(false);
      }
    },
    []
  );

  // Initial quote fetch whenever the tracked tickers change. Uses
  // `silent: true` so no state is set synchronously within the effect body
  // (the existing `loading` skeleton already covers this case).
  // fetchQuotes only sets state inside its async continuation (after
  // `await fetch`), never synchronously during this call.
  useEffect(() => {
    if (tickers.length === 0) return;
    fetchQuotes(tickers, { silent: true }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [tickers, fetchQuotes]);

  // Poll for fresh quotes every 60s, but only while the tab is visible.
  // Earnings data is intentionally left out of the poll — it rarely
  // changes and isn't worth the extra request.
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

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    fetch(`/api/market/earnings?tickers=${tickers.join(",")}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch earnings");
        }
        return res.json() as Promise<EarningsData[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setEarnings(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setEarningsError(
            err instanceof Error ? err.message : "Failed to fetch earnings"
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tickers]);

  useEffect(() => {
    if (tickers.length === 0) return;

    let cancelled = false;

    fetch(`/api/market/analyst?tickers=${tickers.join(",")}`)
      .then(async (res) => {
        if (!res.ok) return;
        return res.json() as Promise<AnalystData[]>;
      })
      .then((data) => {
        if (!cancelled && data) {
          setAnalysts(data);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [tickers]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No tickers in your watchlist. Add one above to get started.
      </p>
    );
  }

  const quoteByTicker = new Map((quotes ?? []).map((q) => [q.ticker, q]));
  const earningsByTicker = new Map(
    (earnings ?? []).map((e) => [e.ticker, e])
  );
  const analystByTicker = new Map(
    (analysts ?? []).map((a) => [a.ticker, a])
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        {lastUpdated && <span>Updated {secondsAgo}s ago</span>}
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          title="Refresh quotes"
        >
          <RefreshIcon spinning={refreshing} />
        </button>
      </div>

      {quotesError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {quotesError}
        </p>
      )}
      {earningsError && (
        <p className="text-sm text-red-600 dark:text-red-400">
          {earningsError}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800">
              <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
                Ticker
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                Price
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                Change
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                Next Earnings
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                EPS Est.
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                Rating
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
                Price Target
              </th>
              <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/50"
                  >
                    <td className="py-3 pr-4">
                      <div className="h-4 w-14 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="ml-auto h-4 w-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="ml-auto h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="ml-auto h-4 w-12 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3 pr-4">
                      <div className="ml-auto h-4 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                    <td className="py-3">
                      <div className="ml-auto h-4 w-14 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                    </td>
                  </tr>
                ))
              : items.map((item) => {
                  const quote = quoteByTicker.get(item.ticker);
                  const earning = earningsByTicker.get(item.ticker);
                  const analyst = analystByTicker.get(item.ticker);
                  const upcoming =
                    earning?.earningsDate &&
                    isWithinDays(earning.earningsDate, 7);
                  const isExpanded = expandedTicker === item.ticker;

                  return (
                    <React.Fragment key={item.id}>
                    <tr
                      className={`border-b border-zinc-100 dark:border-zinc-800/50 cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-zinc-50 dark:bg-zinc-900/30"
                          : "hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20"
                      }`}
                      onClick={() =>
                        setExpandedTicker(isExpanded ? null : item.ticker)
                      }
                    >
                      <td className="py-3 pr-4 font-mono font-medium text-zinc-900 dark:text-zinc-100">
                        <span className="flex items-center gap-1.5">
                          <span
                            className={`inline-block text-[10px] transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                          >
                            ▶
                          </span>
                          {item.ticker}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {quote ? `$${quote.price.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right tabular-nums ${
                          quote ? changeColor(quote.change) : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {quote
                          ? `${quote.change >= 0 ? "+" : ""}$${formatUsd(
                              quote.change
                            )} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`
                          : "—"}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right tabular-nums ${
                          upcoming
                            ? "text-amber-500 font-medium"
                            : "text-zinc-700 dark:text-zinc-300"
                        }`}
                      >
                        {earning?.earningsDate
                          ? formatEarningsDate(earning.earningsDate)
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                        {earning?.epsEstimate !== null &&
                        earning?.epsEstimate !== undefined
                          ? `$${earning.epsEstimate.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className={`py-3 pr-4 text-right text-xs font-medium ${ratingColor(analyst?.recommendationKey)}`}>
                        {analyst?.recommendationKey
                          ? formatRating(analyst.recommendationKey)
                          : "—"}
                        {analyst?.numberOfAnalysts != null && (
                          <span className="ml-1 text-zinc-400 dark:text-zinc-500 font-normal">
                            ({analyst.numberOfAnalysts})
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-xs text-zinc-700 dark:text-zinc-300">
                        {analyst?.targetMeanPrice != null ? (
                          <span>
                            ${formatUsd(analyst.targetMeanPrice)}
                            {analyst.targetLowPrice != null && analyst.targetHighPrice != null && (
                              <span className="ml-1 text-zinc-400 dark:text-zinc-500">
                                ({formatUsd(analyst.targetLowPrice)}–{formatUsd(analyst.targetHighPrice)})
                              </span>
                            )}
                          </span>
                        ) : "—"}
                      </td>
                      <td
                        className="py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DeleteButton id={item.id} />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <TickerDetailPanel
                            ticker={item.ticker}
                            quote={quote}
                            earning={earning}
                            analyst={analyst}
                          />
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>

      {earnings && earnings.length > 0 && (
        <div className="mt-6 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h3 className="mb-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            Earnings Calendar
          </h3>
          <EarningsCalendar earnings={earnings} quotes={quotes} />
        </div>
      )}
    </div>
  );
}
