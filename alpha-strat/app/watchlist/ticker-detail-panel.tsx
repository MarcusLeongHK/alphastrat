"use client";

import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
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
  LineChart,
  Cell,
  Legend,
  ReferenceLine,
} from "recharts";
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
  explain: { ticker: string; explanation: string; generatedAt: string } | null;
}

interface ThesisKeyMetric {
  label: string;
  value: string;
  context: string;
}

interface ThesisData {
  ticker: string;
  rating: string;
  ratingRationale: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  bullSummary?: string;
  bearSummary?: string;
  baseSummary?: string;
  keyMetrics: ThesisKeyMetric[];
  generatedAt: string;
}

interface EarningsTrendEntry {
  period: string;
  epsEstimate: number | null;
  epsGrowth: number | null;
  revenueEstimate: number | null;
  revenueGrowth: number | null;
}

interface EarningsHistoryEntry {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
}

interface QuarterlyRevenueEntry {
  quarter: string;
  revenue: number | null;
  netIncome: number | null;
}

interface EarningsDetailData {
  ticker: string;
  earningsHistory: EarningsHistoryEntry[];
  earningsTrend: EarningsTrendEntry[];
  quarterlyRevenue: QuarterlyRevenueEntry[];
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextRevenueEstimate: number | null;
}

interface OptionsAnalysisData {
  ticker: string;
  underlyingPrice: number;
  signals: {
    expectedMove: { dollars: number; percent: number; upperBound: number; lowerBound: number };
    putCallRatio: number;
    ivSkew: { direction: string; magnitude: number };
    maxPain: number;
    atmIv: number;
    historicalVolatility: number;
    unusualActivity: Array<{
      strike: number;
      expiry: string;
      type: string;
      volume: number;
      openInterest: number;
      volumeOiRatio: number;
    }>;
    termStructure: Array<{ expiry: string; daysToExpiry: number; atmIv: number }>;
    greeksSummary: { atmDelta: number; atmGamma: number; atmTheta: number; atmVega: number };
  };
  analysis: {
    marketPositioning: string;
    expectedMoveAnalysis: string;
    volatilityAssessment: string;
    notableFlow: string;
    keyRisksAndCatalysts: string;
    actionableTakeaway: string;
  };
  ivSurface: Array<{ moneyness: number; iv: number; expiry: string }>;
  ivTermStructure: Array<{ expiry: string; daysToExpiry: number; atmIv: number }>;
  positioning: Array<{
    strike: number;
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
  }>;
  expectedMove: { dollars: number; percent: number; upperBound: number; lowerBound: number };
  maxPain: number;
  putCallRatio: number;
}

type Tab = "overview" | "news" | "sentiment" | "thesis" | "earnings" | "options";

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

function thesisRatingColor(rating: string): string {
  if (rating === "Strong Buy" || rating === "Buy") return "text-emerald-500";
  if (rating === "Hold") return "text-amber-500";
  return "text-red-500";
}

function thesisRatingBg(rating: string): string {
  if (rating === "Strong Buy" || rating === "Buy") return "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50";
  if (rating === "Hold") return "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50";
  return "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50";
}

const RATING_POSITIONS: Record<string, number> = {
  "Strong Sell": 0,
  "Sell": 1,
  "Hold": 2,
  "Buy": 3,
  "Strong Buy": 4,
  "Insufficient Data": 2,
};

const RATING_LABELS_FULL = ["Strong Sell", "Sell", "Hold", "Buy", "Strong Buy"];
const RATING_LABELS_SHORT = ["SS", "S", "H", "B", "SB"];

function RatingGauge({ rating }: { rating: string }) {
  const position = RATING_POSITIONS[rating] ?? 2;
  const pct = (position / 4) * 100;

  return (
    <div className="w-full">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500">
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct}%` }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-white bg-zinc-900 shadow dark:border-zinc-900 dark:bg-white" />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between">
        {RATING_LABELS_FULL.map((label, i) => (
          <span
            key={label}
            className={`text-[9px] md:text-[10px] ${
              i === position
                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            <span className="hidden md:inline">{label}</span>
            <span className="md:hidden">{RATING_LABELS_SHORT[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

const VERDICT_WEIGHTS: Record<string, [number, number]> = {
  "Strong Buy": [90, 10],
  "Buy": [70, 30],
  "Hold": [50, 50],
  "Sell": [30, 70],
  "Strong Sell": [10, 90],
  "Insufficient Data": [50, 50],
};

function VerdictBar({ rating }: { rating: string }) {
  const [bull, bear] = VERDICT_WEIGHTS[rating] ?? [50, 50];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Bull</span>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full">
        <div className="bg-emerald-500" style={{ width: `${bull}%` }} />
        <div className="bg-red-500" style={{ width: `${bear}%` }} />
      </div>
      <span className="text-[10px] text-red-600 dark:text-red-400">Bear</span>
    </div>
  );
}

function CaseAccordion({
  thesisData,
}: {
  thesisData: {
    bullCase: string;
    bearCase: string;
    baseCase: string;
    bullSummary?: string;
    bearSummary?: string;
    baseSummary?: string;
  };
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const cases = [
    {
      key: "bull",
      label: "Bull Case",
      borderColor: "border-l-emerald-500 dark:border-l-emerald-400",
      labelColor: "text-emerald-600 dark:text-emerald-400",
      summary: thesisData.bullSummary || thesisData.bullCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.bullCase,
    },
    {
      key: "bear",
      label: "Bear Case",
      borderColor: "border-l-red-500 dark:border-l-red-400",
      labelColor: "text-red-600 dark:text-red-400",
      summary: thesisData.bearSummary || thesisData.bearCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.bearCase,
    },
    {
      key: "base",
      label: "Base Case",
      borderColor: "border-l-amber-500 dark:border-l-amber-400",
      labelColor: "text-amber-600 dark:text-amber-400",
      summary: thesisData.baseSummary || thesisData.baseCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.baseCase,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {cases.map((c) => {
        const isExpanded = expanded === c.key;
        return (
          <div
            key={c.key}
            className={`rounded-lg border border-l-4 border-zinc-200 ${c.borderColor} dark:border-zinc-800`}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : c.key)}
              className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex-1">
                <h4 className={`text-xs font-semibold uppercase tracking-wider ${c.labelColor}`}>
                  {c.label}
                </h4>
                {!isExpanded && (
                  <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1">
                    {c.summary}
                  </p>
                )}
              </div>
              <svg
                className={`ml-2 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isExpanded && (
              <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">
                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {c.detail}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

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
  const [thesisData, setThesisData] = useState<ThesisData | null>(null);
  const [thesisFetched, setThesisFetched] = useState(false);
  const [thesisError, setThesisError] = useState(false);
  const [thesisRefreshing, setThesisRefreshing] = useState(false);
  const [earningsDetail, setEarningsDetail] = useState<EarningsDetailData | null>(null);
  const [earningsFetched, setEarningsFetched] = useState(false);
  const [earningsError, setEarningsError] = useState(false);
  const [optionsData, setOptionsData] = useState<OptionsAnalysisData | null>(null);
  const [optionsFetched, setOptionsFetched] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [prevTicker, setPrevTicker] = useState(ticker);
  const refreshTickerRef = useRef(ticker);

  if (ticker !== prevTicker) {
    setPrevTicker(ticker);
    setSocialSentiment(null);
    setSocialFetched(false);
    setThesisData(null);
    setThesisFetched(false);
    setThesisError(false);
    setThesisRefreshing(false);
    setEarningsDetail(null);
    setEarningsFetched(false);
    setEarningsError(false);
    setOptionsData(null);
    setOptionsFetched(false);
    setOptionsError(null);
  }

  useEffect(() => {
    refreshTickerRef.current = ticker;
  }, [ticker]);

  const newsLoading = !newsFetched;
  const sentimentLoading = !sentimentFetched;
  const socialLoading = !socialFetched;
  const thesisLoading = !thesisFetched;
  const earningsLoading = !earningsFetched;
  const optionsLoading = !optionsFetched;

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

  useEffect(() => {
    if (activeTab !== "thesis" || thesisFetched) return;

    let cancelled = false;

    fetch(`/api/market/thesis?ticker=${ticker}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ThesisData>;
      })
      .then((data) => {
        if (!cancelled) {
          setThesisData(data);
          setThesisFetched(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setThesisError(true);
          setThesisFetched(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ticker, activeTab, thesisFetched]);

  useEffect(() => {
    if (activeTab !== "earnings" || earningsFetched) return;

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
  }, [ticker, activeTab, earningsFetched]);

  useEffect(() => {
    if (activeTab !== "options" || optionsFetched) return;

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
  }, [activeTab, optionsFetched, ticker]);

  const handleThesisRefresh = useCallback(() => {
    const refreshTicker = ticker;
    refreshTickerRef.current = refreshTicker;
    setThesisRefreshing(true);
    setThesisError(false);

    fetch(`/api/market/thesis?ticker=${refreshTicker}&refresh=true`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ThesisData>;
      })
      .then((data) => {
        if (refreshTickerRef.current === refreshTicker) {
          setThesisData(data);
          setThesisFetched(true);
          setThesisRefreshing(false);
        }
      })
      .catch(() => {
        if (refreshTickerRef.current === refreshTicker) {
          setThesisError(true);
          setThesisRefreshing(false);
        }
      });
  }, [ticker]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "news", label: "News" },
    { key: "sentiment", label: "Sentiment" },
    { key: "thesis", label: "Thesis" },
    { key: "earnings", label: "Earnings" },
    { key: "options", label: "Options" },
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
                    {socialSentiment.explain?.explanation && (
                      <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
                        <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                          AI Trend Explanation
                        </h4>
                        <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                          {socialSentiment.explain.explanation}
                        </p>
                        <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
                          Generated by Llama 3.1 via Adanos
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

      {activeTab === "thesis" && (
        <div className="flex flex-col gap-4">
          {thesisLoading || thesisRefreshing ? (
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-600 dark:border-t-zinc-100" />
              <p className="text-xs text-zinc-400">Generating thesis...</p>
            </div>
          ) : thesisError ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <p className="text-xs text-zinc-400">Unable to generate thesis. Try again later.</p>
              <button
                onClick={handleThesisRefresh}
                className="rounded-md bg-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600"
              >
                Retry
              </button>
            </div>
          ) : thesisData ? (
            <>
              {/* Rating Gauge */}
              <div className={`rounded-lg border p-4 ${thesisRatingBg(thesisData.rating)}`}>
                <div className="flex items-baseline justify-between mb-3">
                  <span className={`text-xl font-bold ${thesisRatingColor(thesisData.rating)}`}>
                    {thesisData.rating}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    Investment Rating
                  </span>
                </div>
                <RatingGauge rating={thesisData.rating} />
                <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                  {thesisData.ratingRationale}
                </p>
                <div className="mt-3">
                  <VerdictBar rating={thesisData.rating} />
                </div>
              </div>

              {/* Key Metrics Grid — unchanged */}
              {thesisData.keyMetrics.length > 0 && (
                <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                  <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Key Metrics
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {thesisData.keyMetrics.map((metric, i) => (
                      <div key={i} className="flex flex-col">
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          {metric.label}
                        </span>
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {metric.value}
                        </span>
                        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                          {metric.context}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bull/Bear/Base Accordion */}
              <CaseAccordion thesisData={thesisData} />

              {/* Footer */}
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                  Generated {timeAgo(thesisData.generatedAt)}
                </span>
                <button
                  onClick={handleThesisRefresh}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {activeTab === "earnings" && (
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
      )}

      {activeTab === "options" && (
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
      )}
    </div>
  );
}
