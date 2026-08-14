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

interface RecommendationPeriod {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

interface RecommendationTrend {
  ticker: string;
  trend: RecommendationPeriod[];
}

interface AdanosSource {
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
  periodDays: number;
  totalUpvotes?: number;
  uniquePosts?: number;
  uniqueTweets?: number;
  topSubreddits?: { subreddit: string; mentions: number }[];
  topTweets?: { textSnippet: string; sentimentLabel: string; likes: number; retweets: number; author: string }[];
}

interface SocialSentimentData {
  ticker: string;
  reddit: AdanosSource | null;
  twitter: AdanosSource | null;
  news: AdanosSource | null;
  polymarket: AdanosSource | null;
  comparison: string | null;
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

function periodLabel(period: string): string {
  if (period === "0m") return "Current";
  if (period === "-1m") return "1mo ago";
  if (period === "-2m") return "2mo ago";
  if (period === "-3m") return "3mo ago";
  return period;
}

function RecBar({ data }: { data: RecommendationPeriod }) {
  const total = data.strongBuy + data.buy + data.hold + data.sell + data.strongSell;
  if (total === 0) return null;
  const segments = [
    { count: data.strongBuy, color: "bg-emerald-600", label: "Strong Buy" },
    { count: data.buy, color: "bg-emerald-400", label: "Buy" },
    { count: data.hold, color: "bg-amber-400", label: "Hold" },
    { count: data.sell, color: "bg-red-400", label: "Sell" },
    { count: data.strongSell, color: "bg-red-600", label: "Strong Sell" },
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500">
          {periodLabel(data.period)}
        </span>
        <div className="flex h-4 flex-1 overflow-hidden rounded">
          {segments.map(
            (seg) =>
              seg.count > 0 && (
                <div
                  key={seg.label}
                  className={`${seg.color} flex items-center justify-center text-[9px] font-medium text-white`}
                  style={{ width: `${(seg.count / total) * 100}%` }}
                  title={`${seg.label}: ${seg.count}`}
                >
                  {seg.count > 0 && total > 3 ? seg.count : ""}
                </div>
              ),
          )}
        </div>
        <span className="w-8 shrink-0 text-right text-[10px] text-zinc-400">
          {total}
        </span>
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

const colorMap = {
  orange: {
    border: "border-orange-200 dark:border-orange-900/50",
    bg: "bg-orange-50 dark:bg-orange-950/20",
    label: "text-orange-600 dark:text-orange-400",
  },
  sky: {
    border: "border-sky-200 dark:border-sky-900/50",
    bg: "bg-sky-50 dark:bg-sky-950/20",
    label: "text-sky-600 dark:text-sky-400",
  },
} as const;

function sentimentLabel(score: number): { text: string; color: string } {
  if (score > 0.2) return { text: "Bullish", color: "text-emerald-500" };
  if (score < -0.2) return { text: "Bearish", color: "text-red-500" };
  return { text: "Neutral", color: "text-amber-500" };
}

function trendLabel(trend: string): { text: string; color: string } {
  if (trend === "rising") return { text: "Rising", color: "text-emerald-500" };
  if (trend === "falling") return { text: "Falling", color: "text-red-500" };
  return { text: "Stable", color: "text-zinc-400" };
}

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function SentimentSourceCard({
  label,
  color,
  source,
  detail,
}: {
  label: string;
  color: keyof typeof colorMap;
  source: AdanosSource;
  detail: React.ReactNode;
}) {
  const c = colorMap[color];
  const sent = sentimentLabel(source.sentimentScore);
  const trend = trendLabel(source.trend);

  return (
    <div className={`rounded border ${c.border} ${c.bg} px-3 py-2`}>
      <div className="mb-2 flex items-center justify-between">
        <div className={`text-[10px] font-semibold uppercase tracking-wider ${c.label}`}>
          {label}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
          <span>{formatCount(source.mentions)} mentions</span>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>{source.periodDays}d</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Buzz</div>
          <div className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {source.buzzScore.toFixed(1)}
          </div>
          <div className={`text-[10px] font-medium ${trend.color}`}>{trend.text}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Sentiment</div>
          <div className={`text-lg font-bold tabular-nums ${sent.color}`}>
            {source.sentimentScore > 0 ? "+" : ""}{source.sentimentScore.toFixed(2)}
          </div>
          <div className={`text-[10px] ${sent.color}`}>{sent.text}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-zinc-400 dark:text-zinc-500">Engagement</div>
          <div className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatCount(source.totalUpvotes ?? source.uniqueTweets ?? 0)}
          </div>
          <div className="text-[10px] text-zinc-400">
            {source.totalUpvotes ? "upvotes" : "tweets"}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="bg-emerald-500 transition-all" style={{ width: `${source.bullishPct}%` }} />
          <div className="bg-zinc-300 transition-all dark:bg-zinc-600" style={{ width: `${100 - source.bullishPct - source.bearishPct}%` }} />
          <div className="bg-red-500 transition-all" style={{ width: `${source.bearishPct}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px]">
          <span className="text-emerald-500">{source.bullishPct.toFixed(0)}% Bullish</span>
          <span className="text-red-500">{source.bearishPct.toFixed(0)}% Bearish</span>
        </div>
      </div>
      {detail}
    </div>
  );
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
  const [recTrend, setRecTrend] = useState<RecommendationTrend | null>(null);
  const [sentimentFetched, setSentimentFetched] = useState(false);
  const [socialSentiment, setSocialSentiment] = useState<SocialSentimentData | null>(null);
  const [socialFetched, setSocialFetched] = useState(false);
  const [prevTicker, setPrevTicker] = useState(ticker);

  if (ticker !== prevTicker) {
    setPrevTicker(ticker);
    setSocialSentiment(null);
    setSocialFetched(false);
  }

  const newsLoading = !newsFetched;
  const sentimentLoading = !sentimentFetched;
  const socialLoading = !socialFetched;

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
        return res.json() as Promise<RecommendationTrend[]>;
      })
      .then((data) => {
        if (!cancelled) {
          setRecTrend(data?.[0] ?? null);
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

  useEffect(() => {
    if (activeTab !== "sentiment" || socialFetched) return;

    let cancelled = false;

    fetch(`/api/market/reddit-sentiment?ticker=${ticker}`)
      .then(async (res) => {
        if (!res.ok) return null;
        return res.json() as Promise<SocialSentimentData>;
      })
      .then((data) => {
        if (!cancelled) {
          setSocialSentiment(data);
          setSocialFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) setSocialFetched(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, activeTab, socialFetched]);

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
          {/* Recommendation Trend */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Analyst Recommendation Trend
            </h4>
            {sentimentLoading ? (
              <div className="h-24 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            ) : recTrend && recTrend.trend.length > 0 ? (
              <div className="flex flex-col gap-2">
                {recTrend.trend.map((period) => (
                  <RecBar key={period.period} data={period} />
                ))}
                <div className="mt-1 flex flex-wrap gap-2 text-[9px]">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> Strong Buy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-emerald-400" /> Buy
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-amber-400" /> Hold
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-red-400" /> Sell
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-2 w-2 rounded-sm bg-red-600" /> Strong Sell
                  </span>
                </div>
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                No recommendation trend data available
              </p>
            )}
          </div>

          {/* Sentiment Summary */}
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Sentiment Summary
            </h4>
            {analyst?.recommendationKey ? (
              <div className="flex flex-col gap-3">
                <div className="text-center">
                  <div className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    Wall Street Consensus
                  </div>
                  <div
                    className={`text-lg font-bold ${ratingColor(analyst.recommendationKey)}`}
                  >
                    {formatRating(analyst.recommendationKey)}
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    {analyst.numberOfAnalysts} analysts
                  </div>
                </div>
                {recTrend && recTrend.trend.length >= 2 && (() => {
                  const current = recTrend.trend.find((t) => t.period === "0m");
                  const prev = recTrend.trend.find((t) => t.period === "-1m");
                  if (!current || !prev) return null;
                  const curBull = current.strongBuy + current.buy;
                  const prevBull = prev.strongBuy + prev.buy;
                  const curBear = current.sell + current.strongSell;
                  const prevBear = prev.sell + prev.strongSell;
                  const bullDiff = curBull - prevBull;
                  const bearDiff = curBear - prevBear;
                  if (bullDiff === 0 && bearDiff === 0) return null;
                  return (
                    <div className="rounded bg-zinc-100 px-2 py-1.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {bullDiff > 0
                        ? `+${bullDiff} analyst${bullDiff > 1 ? "s" : ""} moved to Buy/Strong Buy this month`
                        : bullDiff < 0
                          ? `${bullDiff} analyst${bullDiff < -1 ? "s" : ""} downgraded from Buy this month`
                          : null}
                      {bullDiff !== 0 && bearDiff !== 0 ? ". " : ""}
                      {bearDiff > 0
                        ? `+${bearDiff} new Sell rating${bearDiff > 1 ? "s" : ""} this month`
                        : bearDiff < 0
                          ? `${Math.abs(bearDiff)} Sell rating${Math.abs(bearDiff) > 1 ? "s" : ""} removed this month`
                          : null}
                    </div>
                  );
                })()}
                {socialLoading ? (
                  <div className="h-16 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
                ) : socialSentiment && (socialSentiment.reddit || socialSentiment.twitter) ? (
                  <>
                    {socialSentiment.reddit && (
                      <SentimentSourceCard
                        label="Reddit"
                        color="orange"
                        source={socialSentiment.reddit}
                        detail={
                          socialSentiment.reddit.topSubreddits && socialSentiment.reddit.topSubreddits.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {socialSentiment.reddit.topSubreddits.slice(0, 5).map((sub) => (
                                <span key={sub.subreddit} className="rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                  r/{sub.subreddit} ({sub.mentions})
                                </span>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                    )}
                    {socialSentiment.twitter && (
                      <SentimentSourceCard
                        label="Twitter / X"
                        color="sky"
                        source={socialSentiment.twitter}
                        detail={
                          socialSentiment.twitter.topTweets && socialSentiment.twitter.topTweets.length > 0 ? (
                            <div className="mt-2 flex flex-col gap-1">
                              {socialSentiment.twitter.topTweets.slice(0, 3).map((tweet, i) => (
                                <div key={i} className="text-[10px] text-zinc-500 dark:text-zinc-400">
                                  <span className="font-medium text-sky-600 dark:text-sky-400">@{tweet.author}</span>
                                  {" "}{tweet.textSnippet.slice(0, 120)}{tweet.textSnippet.length > 120 ? "..." : ""}
                                  <span className="ml-1 text-zinc-300 dark:text-zinc-600">
                                    {tweet.likes > 0 && `${tweet.likes} likes`}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : null
                        }
                      />
                    )}
                    {socialSentiment.comparison && (
                      <div className="rounded border border-violet-200 bg-violet-50 px-3 py-2 dark:border-violet-900/50 dark:bg-violet-950/20">
                        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-violet-600 dark:text-violet-400">
                          Retail vs Institutional
                        </div>
                        <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {socialSentiment.comparison}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="rounded bg-zinc-100 px-2 py-1.5 text-xs text-zinc-400 dark:bg-zinc-800">
                    No social sentiment data available
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-zinc-400">
                No analyst data available
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
