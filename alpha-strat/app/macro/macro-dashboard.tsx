"use client";

import { useEffect, useState } from "react";

interface MacroArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface MacroCategory {
  id: string;
  label: string;
  summary: string;
  articles: MacroArticle[];
}

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string;
  generatedAt: string;
}

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
    accent: "border-l-blue-500 dark:border-l-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
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

function OutlookSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-4/6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-4/6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: MacroCategory }) {
  const [expanded, setExpanded] = useState(true);
  const style = CATEGORY_STYLES[category.id] ?? CATEGORY_STYLES.government;

  return (
    <div className={`rounded-lg border border-zinc-200 border-l-4 ${style.accent} dark:border-zinc-800`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {category.label}
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
            {category.articles.length} {category.articles.length === 1 ? "article" : "articles"}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-5 pb-4 pt-3 dark:border-zinc-800">
          {category.summary && (
            <p className={`mb-4 rounded-md px-3 py-2.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 ${style.bg}`}>
              {category.summary}
            </p>
          )}

          {category.articles.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No recent articles in this category.
            </p>
          ) : (
            <ul className="space-y-2">
              {category.articles.map((article, i) => (
                <li key={i} className="group flex items-start justify-between gap-3">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    {article.title}
                  </a>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {timeAgo(article.pubDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function MacroDashboard() {
  const [data, setData] = useState<MacroNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/macro/news")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: MacroNewsResponse) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load macro news");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <OutlookSkeleton />
        {Array.from({ length: 5 }).map((_, i) => (
          <CategorySkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Macro Outlook Hero */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Macro Outlook
          </h2>
          {data.generatedAt && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Updated {timeAgo(data.generatedAt)}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {data.macroOutlook || "Insufficient data for analysis."}
        </p>
      </div>

      {/* Category Sections */}
      {data.categories.map((cat) => (
        <CategorySection key={cat.id} category={cat} />
      ))}
    </div>
  );
}
