"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { NewsArticle, NewsTheme, TickerNews } from "./types";
import { timeAgo } from "./utils";
import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

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
            className="mx-0.5 font-mono text-[10px] text-accent hover:underline"
          >
            [{idx + 1}]
          </a>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

function NewsThemeChips({
  themes,
  articles,
  renderCitedSummary,
}: {
  themes: NewsTheme[];
  articles: NewsArticle[];
  renderCitedSummary: (text: string, articles: NewsArticle[]) => ReactNode;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAllSources, setShowAllSources] = useState(false);
  const selected = themes[selectedIndex];
  const filteredArticles = selected
    ? selected.articleIndices.map((idx) => articles[idx - 1]).filter(Boolean)
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Theme chips row */}
      <div className="flex gap-2 overflow-x-auto md:flex-wrap scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
        {themes.map((theme, i) => (
          <button
            key={i}
            onClick={() => { setSelectedIndex(i); setShowAllSources(false); }}
            className={`min-h-[44px] shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              i === selectedIndex
                ? "border-accent bg-accent text-white"
                : "border-border-secondary text-text-secondary hover:border-text-tertiary"
            }`}
          >
            {theme.label}
          </button>
        ))}
      </div>

      {/* Selected theme detail */}
      {selected && (
        <Card padding="p-4">
          <p className="text-sm leading-relaxed text-text-primary">
            {renderCitedSummary(selected.detail, articles)}
          </p>

          {/* Filtered sources */}
          <div className="mt-3 border-t border-border-primary pt-3">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
              Related Sources
            </div>
            <div className="flex flex-col gap-1">
              {(showAllSources ? articles : filteredArticles).map((article, i) => {
                const originalIndex = showAllSources
                  ? i
                  : selected.articleIndices[i] - 1;
                return (
                  <a
                    key={originalIndex}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors"
                  >
                    <span className="font-mono text-[10px] text-text-tertiary">
                      [{originalIndex + 1}]
                    </span>
                    <span className="truncate group-hover:underline">
                      {article.title}
                    </span>
                    <span className="hidden shrink-0 text-text-tertiary md:inline">
                      — {article.publisher}
                    </span>
                  </a>
                );
              })}
            </div>
            {!showAllSources && filteredArticles.length < articles.length && (
              <button
                onClick={() => setShowAllSources(true)}
                className="mt-2 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Show all {articles.length} sources
              </button>
            )}
            {showAllSources && (
              <button
                onClick={() => setShowAllSources(false)}
                className="mt-2 text-xs font-medium text-text-secondary hover:text-text-primary"
              >
                Show related only
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

interface NewsTabProps {
  ticker: string;
}

export function NewsTab({ ticker }: NewsTabProps) {
  const [news, setNews] = useState<TickerNews | null>(null);
  const [newsFetched, setNewsFetched] = useState(false);
  const newsLoading = !newsFetched;

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

  return (
    <div className="flex flex-col gap-4">
      {newsLoading ? (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : news ? (
        <>
          {news.themes && news.themes.length > 0 && news.articles.length > 0 ? (
            <NewsThemeChips
              themes={news.themes}
              articles={news.articles}
              renderCitedSummary={renderCitedSummary}
            />
          ) : news.aiSummary && news.articles.length > 0 ? (
            /* Fallback: old cached data without themes */
            <Card padding="p-4">
              <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                <span aria-hidden="true">✦</span> News Summary
              </h4>
              <p className="text-sm leading-relaxed text-text-primary">
                {renderCitedSummary(news.aiSummary, news.articles)}
              </p>
              <div className="mt-3 border-t border-border-primary pt-3">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary mb-1.5">
                  Sources
                </div>
                <div className="flex flex-col gap-1">
                  {news.articles.map((article, i) => (
                    <a
                      key={i}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex items-baseline gap-1.5 text-xs text-text-secondary hover:text-accent transition-colors"
                    >
                      <span className="font-mono text-[10px] text-text-tertiary">
                        [{i + 1}]
                      </span>
                      <span className="truncate group-hover:underline">
                        {article.title}
                      </span>
                      <span className="hidden shrink-0 text-text-tertiary md:inline">
                        — {article.publisher}, {timeAgo(article.publishedAt)}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            </Card>
          ) : news.articles.length > 0 ? (
            <Card padding="p-3">
              <p className="text-xs text-text-tertiary mb-2">
                Summary unavailable. Recent articles:
              </p>
              <div className="flex flex-col gap-1">
                {news.articles.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-text-primary hover:text-accent"
                  >
                    {article.title}
                    <span className="ml-1 text-xs text-text-tertiary">
                      ({article.publisher})
                    </span>
                  </a>
                ))}
              </div>
            </Card>
          ) : (
            <p className="text-xs text-text-tertiary">No recent news found</p>
          )}
        </>
      ) : (
        <p className="text-xs text-text-tertiary">Unable to load news</p>
      )}
    </div>
  );
}
