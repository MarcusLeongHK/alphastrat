"use client";

import { type ReactNode, useEffect, useState } from "react";
import type { NewsArticle, NewsTheme, TickerNews } from "./types";
import { timeAgo } from "./utils";

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
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500"
            }`}
          >
            {theme.label}
          </button>
        ))}
      </div>

      {/* Selected theme detail */}
      {selected && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {renderCitedSummary(selected.detail, articles)}
          </p>

          {/* Filtered sources */}
          <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
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
                    className="group flex items-baseline gap-1.5 text-xs text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
                  >
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      [{originalIndex + 1}]
                    </span>
                    <span className="truncate group-hover:underline">
                      {article.title}
                    </span>
                    <span className="hidden shrink-0 text-zinc-300 dark:text-zinc-600 md:inline">
                      — {article.publisher}
                    </span>
                  </a>
                );
              })}
            </div>
            {!showAllSources && filteredArticles.length < articles.length && (
              <button
                onClick={() => setShowAllSources(true)}
                className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Show all {articles.length} sources
              </button>
            )}
            {showAllSources && (
              <button
                onClick={() => setShowAllSources(false)}
                className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Show related only
              </button>
            )}
          </div>
        </div>
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
            <div
              key={i}
              className="h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
            />
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
                      <span className="hidden shrink-0 text-zinc-300 dark:text-zinc-600 md:inline">
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
  );
}
