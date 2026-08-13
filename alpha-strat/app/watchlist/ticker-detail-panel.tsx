"use client";

import { type ReactNode, useEffect, useState } from "react";
import type {
  AnalystData,
  EarningsData,
  QuoteData,
} from "@/lib/market/types";

interface NewsArticle {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  summary?: string;
}

interface TickerNews {
  ticker: string;
  articles: NewsArticle[];
  aiSummary: string | null;
}

interface StockTwitsSentiment {
  ticker: string;
  bullish: number;
  bearish: number;
  messageCount: number;
  sentiment: "bullish" | "bearish" | "neutral" | null;
}

type Tab = "overview" | "news" | "sentiment";

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function ratingColor(key: string | null | undefined): string {
  if (!key) return "text-zinc-500";
  if (key === "strong_buy" || key === "buy") return "text-emerald-500";
  if (key === "hold") return "text-amber-500";
  return "text-red-500";
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function SentimentBar({
  bullish,
  bearish,
}: {
  bullish: number;
  bearish: number;
}) {
  const neutral = Math.max(0, 100 - bullish - bearish);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {bullish > 0 && (
          <div
            className="bg-emerald-500"
            style={{ width: `${bullish}%` }}
          />
        )}
        {neutral > 0 && (
          <div
            className="bg-zinc-300 dark:bg-zinc-600"
            style={{ width: `${neutral}%` }}
          />
        )}
        {bearish > 0 && (
          <div
            className="bg-red-500"
            style={{ width: `${bearish}%` }}
          />
        )}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-emerald-500">{bullish}% Bullish</span>
        <span className="text-red-500">{bearish}% Bearish</span>
      </div>
    </div>
  );
}

function AnalystMeter({ mean }: { mean: number }) {
  const position = ((mean - 1) / 4) * 100;
  const labels = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"];
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500">
        <div
          className="absolute top-0 h-3 w-1 -translate-x-1/2 rounded-full bg-white shadow ring-1 ring-zinc-900/20"
          style={{ left: `${position}%` }}
        />
      </div>
      <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500">
        {labels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
    </div>
  );
}

function renderCitedSummary(
  summary: string,
  articles: { link: string }[]
): ReactNode[] {
  const parts = summary.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      const article = articles[idx];
      if (article) {
        return (
          <a
            key={i}
            href={article.link}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-0.5 font-mono text-[10px] text-blue-500 hover:text-blue-400 hover:underline"
          >
            [{idx + 1}]
          </a>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

interface TickerDetailPanelProps {
  ticker: string;
  quote: QuoteData | undefined;
  earning: EarningsData | undefined;
  analyst: AnalystData | undefined;
}

export function TickerDetailPanel({
  ticker,
  quote,
  earning,
  analyst,
}: TickerDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [news, setNews] = useState<TickerNews | null>(null);
  const [newsFetched, setNewsFetched] = useState(false);
  const [sentiment, setSentiment] = useState<StockTwitsSentiment | null>(null);
  const [sentimentFetched, setSentimentFetched] = useState(false);

  const newsLoading = !newsFetched;
  const sentimentLoading = !sentimentFetched;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/market/news?ticker=${ticker}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<TickerNews>;
      })
      .then((data) => {
        if (!cancelled) {
          setNews(data);
          setNewsFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) setNewsFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/market/sentiment?tickers=${ticker}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<StockTwitsSentiment[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setSentiment(data?.[0] ?? null);
          setSentimentFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSentimentFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "news", label: "News" },
    { key: "sentiment", label: "Sentiment" },
  ];

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mb-4 flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-200 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Analyst Ratings */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
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
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {analyst.numberOfAnalysts} analysts
                  </span>
                </div>
                {analyst.recommendationMean != null && (
                  <AnalystMeter mean={analyst.recommendationMean} />
                )}
                {analyst.targetMeanPrice != null && (
                  <div className="mt-1 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        Low
                      </div>
                      <div className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                        ${formatUsd(analyst.targetLowPrice ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        Mean Target
                      </div>
                      <div className="text-sm font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
                        ${formatUsd(analyst.targetMeanPrice)}
                      </div>
                      {quote && (
                        <div
                          className={`text-[10px] font-medium ${
                            analyst.targetMeanPrice > quote.price
                              ? "text-emerald-500"
                              : "text-red-500"
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
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        High
                      </div>
                      <div className="text-sm font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
                        ${formatUsd(analyst.targetHighPrice ?? 0)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No analyst data available</p>
            )}
          </div>

          {/* Earnings Info */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Next Earnings
            </h4>
            {earning?.earningsDate ? (
              <div className="flex flex-col gap-2">
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  {new Date(earning.earningsDate).toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      EPS Estimate
                    </div>
                    <div className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {earning.epsEstimate != null
                        ? `$${earning.epsEstimate.toFixed(2)}`
                        : "—"}
                    </div>
                    {earning.epsLow != null && earning.epsHigh != null && (
                      <div className="text-[10px] tabular-nums text-zinc-400">
                        Range: ${earning.epsLow.toFixed(2)} – $
                        {earning.epsHigh.toFixed(2)}
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      Revenue Estimate
                    </div>
                    <div className="text-sm font-medium tabular-nums text-zinc-900 dark:text-zinc-100">
                      {earning.revenueEstimate != null
                        ? formatRevenue(earning.revenueEstimate)
                        : "—"}
                    </div>
                    {earning.revenueLow != null &&
                      earning.revenueHigh != null && (
                        <div className="text-[10px] tabular-nums text-zinc-400">
                          Range: {formatRevenue(earning.revenueLow)} –{" "}
                          {formatRevenue(earning.revenueHigh)}
                        </div>
                      )}
                  </div>
                </div>
                {earning.marketCap != null && (
                  <div className="mt-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      Market Cap:{" "}
                    </span>
                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                      {formatMarketCap(earning.marketCap)}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">No earnings date available</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "news" && (
        <div className="flex flex-col gap-4">
          {newsLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
                />
              ))}
            </div>
          ) : news ? (
            <>
              {news.aiSummary && news.articles.length > 0 ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
                  <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span aria-hidden="true">✦</span> News Summary
                  </h4>
                  <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {renderCitedSummary(news.aiSummary, news.articles)}
                  </p>
                  <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                      Sources
                    </div>
                    <div className="flex flex-col gap-1">
                      {news.articles.map((article, i) => (
                        <a
                          key={i}
                          href={article.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-baseline gap-1.5 text-xs text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
                        >
                          <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                            [{i + 1}]
                          </span>
                          <span className="truncate group-hover:underline">
                            {article.title}
                          </span>
                          <span className="shrink-0 text-zinc-300 dark:text-zinc-600">
                            — {article.publisher}, {timeAgo(article.publishedAt)}
                          </span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : news.articles.length > 0 ? (
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <p className="text-xs text-zinc-400 mb-2">
                    Summary unavailable. Recent articles:
                  </p>
                  <div className="flex flex-col gap-1">
                    {news.articles.map((article, i) => (
                      <a
                        key={i}
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-zinc-700 hover:text-blue-500 dark:text-zinc-300 dark:hover:text-blue-400"
                      >
                        {article.title}
                        <span className="ml-1 text-xs text-zinc-400">
                          ({article.publisher})
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-zinc-400">No recent news found</p>
              )}
            </>
          ) : (
            <p className="text-xs text-zinc-400">Unable to load news</p>
          )}
        </div>
      )}

      {activeTab === "sentiment" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* StockTwits Sentiment */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              StockTwits Sentiment
            </h4>
            {sentimentLoading ? (
              <div className="h-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            ) : sentiment && sentiment.sentiment !== null ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span
                    className={`text-lg font-bold ${
                      sentiment.sentiment === "bullish"
                        ? "text-emerald-500"
                        : sentiment.sentiment === "bearish"
                          ? "text-red-500"
                          : "text-zinc-500"
                    }`}
                  >
                    {sentiment.sentiment.charAt(0).toUpperCase() +
                      sentiment.sentiment.slice(1)}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {sentiment.messageCount} messages
                  </span>
                </div>
                <SentimentBar
                  bullish={sentiment.bullish}
                  bearish={sentiment.bearish}
                />
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                No sentiment data available
              </p>
            )}
          </div>

          {/* Analyst vs Sentiment comparison */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Analyst vs Retail
            </h4>
            {analyst?.recommendationKey && sentiment?.sentiment ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      Wall Street
                    </div>
                    <div
                      className={`text-sm font-bold ${ratingColor(analyst.recommendationKey)}`}
                    >
                      {formatRating(analyst.recommendationKey)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {analyst.numberOfAnalysts} analysts
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      Retail / Social
                    </div>
                    <div
                      className={`text-sm font-bold ${
                        sentiment.sentiment === "bullish"
                          ? "text-emerald-500"
                          : sentiment.sentiment === "bearish"
                            ? "text-red-500"
                            : "text-zinc-500"
                      }`}
                    >
                      {sentiment.sentiment.charAt(0).toUpperCase() +
                        sentiment.sentiment.slice(1)}
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      {sentiment.messageCount} posts
                    </div>
                  </div>
                </div>
                {analyst.recommendationKey !== sentiment.sentiment &&
                  !(
                    (analyst.recommendationKey === "strong_buy" ||
                      analyst.recommendationKey === "buy") &&
                    sentiment.sentiment === "bullish"
                  ) && (
                    <div className="rounded bg-amber-50 px-2 py-1.5 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                      Analyst and retail sentiment diverge — worth
                      investigating further.
                    </div>
                  )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                Need both analyst and sentiment data for comparison
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
