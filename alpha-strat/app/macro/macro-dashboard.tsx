"use client";

import { useEffect, useState, useCallback } from "react";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";

interface MacroArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface MacroOutlookData {
  sentimentLabel: string;
  headline: string;
  keyDrivers: string[];
}

interface MacroCategory {
  id: string;
  label: string;
  summary: string;
  oneLiner?: string;
  articles: MacroArticle[];
}

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string | MacroOutlookData;
  generatedAt: string;
}

interface TrendingTicker {
  ticker: string;
  mentions: number;
  buzzScore: number;
  sentimentScore: number;
  trend: string;
}

interface MarketSentimentData {
  overallScore: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  totalMentions: number;
  tickerCount: number;
}

interface SectorSentiment {
  sector: string;
  sentimentScore: number;
  buzzScore: number;
  mentions: number;
  trend: string;
}

interface MarketMoodData {
  trending: TrendingTicker[];
  marketSentiment: MarketSentimentData | null;
  sectors: SectorSentiment[];
}

const ALL_SECTIONS = ["fed", "geopolitics", "commodities", "jobs", "government"];

const SECTION_LABELS: Record<string, string> = {
  fed: "Federal Reserve",
  geopolitics: "Geopolitics",
  commodities: "Commodities",
  jobs: "Jobs & Economic Data",
  government: "US Government",
};

const CATEGORY_STYLES: Record<string, { accent: string; bg: string; badge: string }> = {
  fed: {
    accent: "border-l-violet-500 dark:border-l-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  geopolitics: {
    accent: "border-l-rose-500 dark:border-l-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  commodities: {
    accent: "border-l-amber-500 dark:border-l-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  jobs: {
    accent: "border-l-emerald-500 dark:border-l-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  government: {
    accent: "border-l-sky-500 dark:border-l-sky-400",
    bg: "bg-sky-50 dark:bg-sky-950/30",
    badge: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
  },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Card>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-4 h-3 w-full" />
        <Skeleton className="mt-2 h-3 w-5/6" />
        <Skeleton className="mt-2 h-3 w-4/6" />
      </Card>
      {[...Array(3)].map((_, i) => (
        <Card key={i}>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="mt-3 h-16 w-full" />
        </Card>
      ))}
    </div>
  );
}

const INITIAL_ARTICLE_COUNT = 5;

function CategorySection({ category, index }: { category: MacroCategory; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const style = CATEGORY_STYLES[category.id] ?? CATEGORY_STYLES.government;
  const visibleArticles = showAll ? category.articles : category.articles.slice(0, INITIAL_ARTICLE_COUNT);
  const hasMore = category.articles.length > INITIAL_ARTICLE_COUNT;

  return (
    <div
      className={`rounded-lg border border-border-primary border-l-4 ${style.accent} animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold text-text-primary">
              {category.label}
            </h3>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
              {category.articles.length}
            </span>
          </div>
          {!expanded && category.oneLiner && (
            <p className="mt-1 text-xs text-text-tertiary line-clamp-1">
              {category.oneLiner}
            </p>
          )}
        </div>
        <svg
          className={`ml-2 h-4 w-4 shrink-0 text-text-tertiary transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div className={`grid ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} expand-collapse`}>
        <div className="overflow-hidden">
          <div className="border-t border-border-primary px-5 pb-4 pt-3">
            {category.summary && (
              <p className={`mb-4 rounded-md px-3 py-2.5 text-sm leading-relaxed text-text-secondary ${style.bg}`}>
                {category.summary}
              </p>
            )}

            {category.articles.length === 0 ? (
              <p className="text-sm text-text-tertiary">
                No recent articles in this category.
              </p>
            ) : (
              <>
                <ul className="space-y-2">
                  {visibleArticles.map((article, i) => (
                    <li key={i} className="group flex items-start justify-between gap-3 py-2">
                      <a
                        href={article.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-text-secondary hover:text-text-primary"
                      >
                        {article.title}
                      </a>
                      <span className="hidden shrink-0 text-xs text-text-tertiary md:inline">
                        {timeAgo(article.pubDate)}
                      </span>
                    </li>
                  ))}
                </ul>
                {hasMore && (
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-2 text-xs font-medium text-text-tertiary hover:text-text-primary"
                  >
                    {showAll ? "Show less" : `Show ${category.articles.length - INITIAL_ARTICLE_COUNT} more`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionSettings({
  enabledSections,
  onToggle,
  onClose,
}: {
  enabledSections: string[];
  onToggle: (sectionId: string) => void;
  onClose: () => void;
}) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Customize Sections
        </h3>
        <button
          onClick={onClose}
          className="text-text-tertiary hover:text-text-primary"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="space-y-2">
        {ALL_SECTIONS.map((id) => {
          const enabled = enabledSections.includes(id);
          const isLastEnabled = enabled && enabledSections.length === 1;
          return (
            <label
              key={id}
              className={`flex min-h-[44px] items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                enabled
                  ? "bg-surface-tertiary text-text-primary"
                  : "text-text-tertiary"
              } ${isLastEnabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-surface-tertiary"}`}
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={isLastEnabled}
                onChange={() => onToggle(id)}
                className="h-3.5 w-3.5 rounded border-border-secondary text-text-primary accent-accent"
              />
              {SECTION_LABELS[id]}
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-text-tertiary">
        At least 1 section required. Max 5.
      </p>
    </Card>
  );
}

function tickerChipClasses(sentimentScore: number): string {
  if (sentimentScore > 0.6) {
    return "bg-success/15 text-success";
  }
  if (sentimentScore < 0.4) {
    return "bg-danger/15 text-danger";
  }
  return "bg-surface-tertiary text-text-secondary";
}

function sectorScoreClasses(sentimentScore: number): string {
  if (sentimentScore > 0.6) return "text-success";
  if (sentimentScore < 0.4) return "text-danger";
  return "text-text-tertiary";
}

function MarketMoodSection({ data }: { data: MarketMoodData }) {
  const sentiment = data.marketSentiment;
  const bullishPct = sentiment?.bullishPct ?? 0;
  const bearishPct = sentiment?.bearishPct ?? 0;
  const neutralPct = sentiment?.neutralPct ?? Math.max(0, 100 - bullishPct - bearishPct);
  const topTrending = data.trending.slice(0, 8);

  return (
    <Card padding="p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
        Market Mood
      </h2>

      {sentiment && (
        <div className="mt-4">
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-surface-tertiary">
            <div className="bg-success" style={{ width: `${bullishPct}%` }} />
            <div className="bg-border-secondary" style={{ width: `${neutralPct}%` }} />
            <div className="bg-danger" style={{ width: `${bearishPct}%` }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary">
            <span className="text-success">
              {bullishPct.toFixed(0)}% bullish
            </span>
            <span>{sentiment.totalMentions.toLocaleString()} mentions</span>
            <span className="text-danger">
              {bearishPct.toFixed(0)}% bearish
            </span>
          </div>
        </div>
      )}

      {topTrending.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Trending
          </h3>
          <div className="flex flex-wrap gap-2">
            {topTrending.map((t) => (
              <span
                key={t.ticker}
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${tickerChipClasses(t.sentimentScore)}`}
              >
                {t.ticker}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.sectors.length > 0 && (
        <div className="mt-5">
          <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-text-tertiary">
            Sectors
          </h3>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {data.sectors.map((s) => (
              <div
                key={s.sector}
                className="rounded-md border border-border-primary px-3 py-2"
              >
                <div className="text-xs font-medium text-text-secondary">
                  {s.sector}
                </div>
                <div className={`text-sm font-semibold ${sectorScoreClasses(s.sentimentScore)}`}>
                  {s.sentimentScore.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

export function MacroDashboard() {
  const [data, setData] = useState<MacroNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledSections, setEnabledSections] = useState<string[]>(ALL_SECTIONS);
  const [showSettings, setShowSettings] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [marketMood, setMarketMood] = useState<MarketMoodData | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/macro/market-mood")
      .then(async (res) => {
        if (!res.ok) return;
        return res.json() as Promise<MarketMoodData>;
      })
      .then((data) => {
        if (!cancelled && data) setMarketMood(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/macro/news").then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
      fetch("/api/macro/preferences").then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }),
    ])
      .then(([newsJson, prefsJson]: [MacroNewsResponse, { enabledSections: string[] }]) => {
        setData(newsJson);
        setEnabledSections(prefsJson.enabledSections);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load macro news");
      })
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = useCallback(
    (sectionId: string) => {
      if (savingPrefs) return;

      const newSections = enabledSections.includes(sectionId)
        ? enabledSections.filter((s) => s !== sectionId)
        : [...enabledSections, sectionId];

      if (newSections.length === 0 || newSections.length > 5) return;

      setEnabledSections(newSections);
      setSavingPrefs(true);

      fetch("/api/macro/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabledSections: newSections }),
      })
        .catch((err) => {
          console.warn("[macro] failed to save preferences:", err);
          setEnabledSections(enabledSections);
        })
        .finally(() => setSavingPrefs(false));
    },
    [enabledSections, savingPrefs]
  );

  if (loading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const filteredCategories = data.categories.filter((cat) =>
    enabledSections.includes(cat.id)
  );

  const sentimentLabel = typeof data.macroOutlook === "string" ? null : data.macroOutlook.sentimentLabel;
  const sentimentVariant =
    sentimentLabel === "Bullish"
      ? "bullish"
      : sentimentLabel === "Bearish"
        ? "bearish"
        : sentimentLabel === "Cautious"
          ? "mixed"
          : "neutral";

  return (
    <div className="space-y-4">
      {marketMood && <MarketMoodSection data={marketMood} />}

      {/* Macro Outlook Hero */}
      <Card padding="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-tertiary">
            Macro Outlook
          </h2>
          <div className="flex items-center gap-3">
            {data.generatedAt && (
              <span className="text-xs text-text-tertiary">
                Updated {timeAgo(data.generatedAt)}
              </span>
            )}
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 transition-colors ${
                showSettings
                  ? "bg-surface-tertiary text-text-primary"
                  : "text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary"
              }`}
              title="Customize sections"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        {typeof data.macroOutlook === "string" ? (
          /* Fallback: old cached data */
          <p className="mt-3 text-sm leading-relaxed text-text-primary">
            {data.macroOutlook || "Insufficient data for analysis."}
          </p>
        ) : (
          /* New structured outlook */
          <div className="mt-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
              <Badge variant={sentimentVariant}>{data.macroOutlook.sentimentLabel}</Badge>
              <p className="text-base font-medium text-text-primary">
                {data.macroOutlook.headline}
              </p>
            </div>
            {data.macroOutlook.keyDrivers.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {data.macroOutlook.keyDrivers.map((driver, i) => (
                  <span
                    key={i}
                    className="rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs text-text-secondary"
                  >
                    {driver}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Section Settings Panel */}
      {showSettings && (
        <SectionSettings
          enabledSections={enabledSections}
          onToggle={handleToggle}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Category Sections */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredCategories.map((cat, index) => (
          <CategorySection key={cat.id} category={cat} index={index} />
        ))}
      </div>
    </div>
  );
}
