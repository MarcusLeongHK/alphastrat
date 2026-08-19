"use client";

import { useEffect, useState } from "react";
import type { AnalystData } from "@/lib/market/types";
import type { AdanosSource, RecommendationPeriod, RecommendationTrend, SocialSentimentData } from "./types";
import { ratingColor, formatRating } from "./utils";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

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
    { count: data.strongBuy, color: "bg-success", label: "Strong Buy" },
    { count: data.buy, color: "bg-success/70", label: "Buy" },
    { count: data.hold, color: "bg-warning", label: "Hold" },
    { count: data.sell, color: "bg-danger/70", label: "Sell" },
    { count: data.strongSell, color: "bg-danger", label: "Strong Sell" },
  ];
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-[10px] text-text-tertiary">
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
        <span className="w-8 shrink-0 text-right text-[10px] text-text-tertiary">
          {total}
        </span>
      </div>
    </div>
  );
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
  if (score > 0.2) return { text: "Bullish", color: "text-success" };
  if (score < -0.2) return { text: "Bearish", color: "text-danger" };
  return { text: "Neutral", color: "text-warning" };
}

function trendLabel(trend: string): { text: string; color: string } {
  if (trend === "rising") return { text: "Rising", color: "text-success" };
  if (trend === "falling") return { text: "Falling", color: "text-danger" };
  return { text: "Stable", color: "text-text-tertiary" };
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
        <div className="flex items-center gap-1.5 text-[10px] text-text-tertiary">
          <span>{formatCount(source.mentions)} mentions</span>
          <span className="text-border-secondary">|</span>
          <span>{source.periodDays}d</span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="text-center">
          <div className="text-[10px] text-text-tertiary">Buzz</div>
          <div className="text-lg font-bold tabular-nums text-text-primary">
            {source.buzzScore.toFixed(1)}
          </div>
          <div className={`text-[10px] font-medium ${trend.color}`}>{trend.text}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-text-tertiary">Sentiment</div>
          <div className={`text-lg font-bold tabular-nums ${sent.color}`}>
            {source.sentimentScore > 0 ? "+" : ""}{source.sentimentScore.toFixed(2)}
          </div>
          <div className={`text-[10px] ${sent.color}`}>{sent.text}</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] text-text-tertiary">Engagement</div>
          <div className="text-lg font-bold tabular-nums text-text-primary">
            {formatCount(source.totalUpvotes ?? source.uniqueTweets ?? 0)}
          </div>
          <div className="text-[10px] text-text-tertiary">
            {source.totalUpvotes ? "upvotes" : "tweets"}
          </div>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex h-3 overflow-hidden rounded-full">
          <div className="bg-success transition-all" style={{ width: `${source.bullishPct}%` }} />
          <div className="bg-border-secondary transition-all" style={{ width: `${100 - source.bullishPct - source.bearishPct}%` }} />
          <div className="bg-danger transition-all" style={{ width: `${source.bearishPct}%` }} />
        </div>
        <div className="mt-0.5 flex justify-between text-[10px]">
          <span className="text-success">{source.bullishPct.toFixed(0)}% Bullish</span>
          <span className="text-danger">{source.bearishPct.toFixed(0)}% Bearish</span>
        </div>
      </div>
      {detail}
    </div>
  );
}

interface SentimentTabProps {
  ticker: string;
  analyst: AnalystData | undefined;
}

export function SentimentTab({ ticker, analyst }: SentimentTabProps) {
  const [recTrend, setRecTrend] = useState<RecommendationTrend | null>(null);
  const [sentimentFetched, setSentimentFetched] = useState(false);
  const [socialSentiment, setSocialSentiment] = useState<SocialSentimentData | null>(null);
  const [socialFetched, setSocialFetched] = useState(false);

  const sentimentLoading = !sentimentFetched;
  const socialLoading = !socialFetched;

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
  }, [ticker]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Recommendation Trend */}
      <Card className="p-3">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Analyst Recommendation Trend
        </h4>
        {sentimentLoading ? (
          <Skeleton className="h-24" />
        ) : recTrend && recTrend.trend.length > 0 ? (
          <div className="flex flex-col gap-2">
            {recTrend.trend.map((period) => (
              <RecBar key={period.period} data={period} />
            ))}
            <div className="mt-1 flex flex-wrap gap-2 text-[9px]">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-success" /> Strong Buy
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-success/70" /> Buy
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-warning" /> Hold
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-danger/70" /> Sell
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-2 rounded-sm bg-danger" /> Strong Sell
              </span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            No recommendation trend data available
          </p>
        )}
      </Card>

      {/* Sentiment Summary */}
      <Card className="p-3">
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Sentiment Summary
        </h4>
        {analyst?.recommendationKey ? (
          <div className="flex flex-col gap-3">
            <div className="text-center">
              <div className="text-[10px] text-text-tertiary">
                Wall Street Consensus
              </div>
              <div
                className={`text-lg font-bold ${ratingColor(analyst.recommendationKey)}`}
              >
                {formatRating(analyst.recommendationKey)}
              </div>
              <div className="text-[10px] text-text-tertiary">
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
                <div className="rounded bg-surface-tertiary px-2 py-1.5 text-xs text-text-secondary">
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
              <Skeleton className="h-16" />
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
                            <div key={i} className="text-[10px] text-text-secondary">
                              <span className="font-medium text-sky-600 dark:text-sky-400">@{tweet.author}</span>
                              {" "}{tweet.textSnippet.slice(0, 120)}{tweet.textSnippet.length > 120 ? "..." : ""}
                              <span className="ml-1 text-text-tertiary">
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
                    <p className="text-xs leading-relaxed text-text-primary">
                      {socialSentiment.comparison}
                    </p>
                  </div>
                )}
                {socialSentiment.explain?.explanation && (
                  <Card className="mt-4 p-4">
                    <h4 className="text-xs font-medium text-text-secondary">
                      AI Trend Explanation
                    </h4>
                    <p className="mt-2 text-sm leading-relaxed text-text-primary">
                      {socialSentiment.explain.explanation}
                    </p>
                    <p className="mt-1.5 text-[10px] text-text-tertiary">
                      Generated by Llama 3.1 via Adanos
                    </p>
                  </Card>
                )}
              </>
            ) : (
              <div className="rounded bg-surface-tertiary px-2 py-1.5 text-xs text-text-tertiary">
                No social sentiment data available
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-text-tertiary">
            No analyst data available
          </p>
        )}
      </Card>
    </div>
  );
}
