"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useActionState } from "react";
import type { WatchlistItem } from "@/lib/types";
import type { QuoteData, EarningsData, AnalystData } from "@/lib/market/types";
import { removeFromWatchlist, type ActionResult } from "./actions";
import { TickerDetailPanel } from "./ticker-detail-panel";
import { BottomSheet } from "./bottom-sheet";
import { Skeleton } from "@/app/components/ui/skeleton";

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
        className="text-sm text-danger hover:opacity-80 disabled:opacity-50"
      >
        {isPending ? "..." : "Remove"}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-danger">{state.error}</span>
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
  if (value > 0) return "text-success";
  if (value < 0) return "text-danger";
  return "text-text-secondary";
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
  if (!key) return "text-text-secondary";
  if (key === "strong_buy" || key === "buy") return "text-success";
  if (key === "hold") return "text-warning";
  return "text-danger";
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
  if (days < 0) return "text-text-tertiary";
  if (days <= 3) return "text-danger";
  if (days <= 7) return "text-warning";
  return "text-accent";
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
      <p className="text-sm text-text-secondary">
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
            <span className="text-sm font-medium text-text-primary">
              {formatEarningsDate(date)}
            </span>
            <span
              className={`text-xs font-medium ${countdownColor(date)}`}
            >
              {countdownLabel(date)}
            </span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border-primary">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border-primary bg-surface-secondary">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">
                    Ticker
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
                    Price
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
                    Mkt Cap
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
                    EPS Est.
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
                    EPS Range
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
                    Rev Est.
                  </th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">
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
                      className="border-b border-border-primary/60 last:border-b-0"
                    >
                      <td className="px-3 py-2.5 font-mono font-semibold text-text-primary">
                        {e.ticker}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
                        {quote ? `$${quote.price.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-primary">
                        {e.marketCap != null
                          ? formatMarketCap(e.marketCap)
                          : quote?.marketCap != null
                            ? formatMarketCap(quote.marketCap)
                            : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-text-primary">
                        {e.epsEstimate != null
                          ? `$${e.epsEstimate.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
                        {e.epsLow != null && e.epsHigh != null
                          ? `$${e.epsLow.toFixed(2)} – $${e.epsHigh.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-text-primary">
                        {e.revenueEstimate != null
                          ? formatRevenue(e.revenueEstimate)
                          : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-text-secondary">
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

  useEffect(() => {
    if (tickers.length === 0) return;
    tickers.forEach((t) => {
      fetch(`/api/market/reddit-sentiment?ticker=${t}`).catch(() => {});
    });
  }, [tickers]);

  if (items.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
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

      {quotesError && (
        <p className="text-sm text-danger">
          {quotesError}
        </p>
      )}
      {earningsError && (
        <p className="text-sm text-danger">
          {earningsError}
        </p>
      )}
      {/* Mobile card list */}
      <div className="flex flex-col gap-3 md:hidden">
        {loading
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-[80px] rounded-lg border border-border-primary p-4"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-4 w-20" />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))
          : items.map((item) => {
              const quote = quoteByTicker.get(item.ticker);
              const earning = earningsByTicker.get(item.ticker);
              const analyst = analystByTicker.get(item.ticker);
              const upcoming =
                earning?.earningsDate && isWithinDays(earning.earningsDate, 7);
              const isExpanded = expandedTicker === item.ticker;

              return (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  className={`flex min-h-[44px] w-full cursor-pointer flex-col gap-2 rounded-lg border p-4 text-left transition-colors active:bg-surface-secondary ${
                    isExpanded
                      ? "bg-surface-secondary border-border-primary"
                      : "border-border-primary"
                  }`}
                  onClick={() =>
                    setExpandedTicker(isExpanded ? null : item.ticker)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setExpandedTicker(isExpanded ? null : item.ticker);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-mono text-base font-semibold text-text-primary">
                      <span
                        className={`inline-block text-[10px] transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {item.ticker}
                    </span>
                    <span className="tabular-nums text-base text-text-primary">
                      {quote ? `$${quote.price.toFixed(2)}` : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span
                      className={`tabular-nums ${
                        quote
                          ? changeColor(quote.change)
                          : "text-text-primary"
                      }`}
                    >
                      {quote
                        ? `${quote.change >= 0 ? "+" : ""}$${formatUsd(
                            quote.change
                          )} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`
                        : "—"}
                    </span>
                    <span
                      className={`text-xs font-medium ${ratingColor(analyst?.recommendationKey)}`}
                    >
                      {analyst?.recommendationKey
                        ? formatRating(analyst.recommendationKey)
                        : "—"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-text-secondary">
                    <span
                      className={
                        upcoming
                          ? "font-medium text-warning"
                          : "text-text-secondary"
                      }
                    >
                      {earning?.earningsDate
                        ? `Earnings: ${formatEarningsDate(earning.earningsDate)}`
                        : "Earnings: —"}
                    </span>
                    <span
                      onClick={(e) => e.stopPropagation()}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-end"
                    >
                      <DeleteButton id={item.id} />
                    </span>
                  </div>
                </div>
              );
            })}
      </div>

      <BottomSheet
        open={!!expandedTicker}
        onClose={() => setExpandedTicker(null)}
        title={expandedTicker ?? ""}
      >
        {expandedTicker && (
          <div className="animate-fade-in">
            <TickerDetailPanel
              key={expandedTicker}
              ticker={expandedTicker}
              quote={quoteByTicker.get(expandedTicker) ?? undefined}
              earning={earningsByTicker.get(expandedTicker) ?? undefined}
              analyst={analystByTicker.get(expandedTicker) ?? undefined}
            />
          </div>
        )}
      </BottomSheet>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="pb-2 pr-4 text-left font-medium text-text-secondary">
                Ticker
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
                Price
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
                Change
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
                Next Earnings
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
                EPS Est.
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
                Rating
              </th>
              <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
                Price Target
              </th>
              <th className="pb-2 text-right font-medium text-text-secondary"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? items.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-border-primary/60"
                  >
                    <td className="py-3 pr-4">
                      <Skeleton className="h-4 w-14" />
                    </td>
                    <td className="py-3 pr-4">
                      <Skeleton className="ml-auto h-4 w-16" />
                    </td>
                    <td className="py-3 pr-4">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </td>
                    <td className="py-3 pr-4">
                      <Skeleton className="ml-auto h-4 w-24" />
                    </td>
                    <td className="py-3 pr-4">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </td>
                    <td className="py-3 pr-4">
                      <Skeleton className="ml-auto h-4 w-12" />
                    </td>
                    <td className="py-3 pr-4">
                      <Skeleton className="ml-auto h-4 w-20" />
                    </td>
                    <td className="py-3">
                      <Skeleton className="ml-auto h-4 w-14" />
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
                      className={`border-b border-border-primary/60 cursor-pointer transition-colors ${
                        isExpanded
                          ? "bg-surface-secondary"
                          : "hover:bg-surface-tertiary/50"
                      }`}
                      onClick={() =>
                        setExpandedTicker(isExpanded ? null : item.ticker)
                      }
                    >
                      <td className="py-3 pr-4 font-mono font-medium text-text-primary">
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
                      <td className="py-3 pr-4 text-right tabular-nums text-text-primary">
                        {quote ? `$${quote.price.toFixed(2)}` : "—"}
                      </td>
                      <td
                        className={`py-3 pr-4 text-right tabular-nums ${
                          quote ? changeColor(quote.change) : "text-text-primary"
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
                            ? "text-warning font-medium"
                            : "text-text-primary"
                        }`}
                      >
                        {earning?.earningsDate
                          ? formatEarningsDate(earning.earningsDate)
                          : "—"}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-text-primary">
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
                          <span className="ml-1 text-text-tertiary font-normal">
                            ({analyst.numberOfAnalysts})
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-xs text-text-primary">
                        {analyst?.targetMeanPrice != null ? (
                          <span>
                            ${formatUsd(analyst.targetMeanPrice)}
                            {analyst.targetLowPrice != null && analyst.targetHighPrice != null && (
                              <span className="ml-1 text-text-tertiary">
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
                          <div className="animate-fade-in">
                            <TickerDetailPanel
                              key={item.ticker}
                              ticker={item.ticker}
                              quote={quote}
                              earning={earning}
                              analyst={analyst}
                            />
                          </div>
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
        <div className="mt-6 rounded-lg border border-border-primary p-4">
          <h3 className="mb-4 text-sm font-medium text-text-primary">
            Earnings Calendar
          </h3>
          <EarningsCalendar earnings={earnings} quotes={quotes} />
        </div>
      )}
    </div>
  );
}
