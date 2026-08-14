"use client";

import { useEffect, useState, useCallback } from "react";

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

const INITIAL_ARTICLE_COUNT = 5;

function CategorySection({ category }: { category: MacroCategory }) {
  const [expanded, setExpanded] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const style = CATEGORY_STYLES[category.id] ?? CATEGORY_STYLES.government;
  const visibleArticles = showAll ? category.articles : category.articles.slice(0, INITIAL_ARTICLE_COUNT);
  const hasMore = category.articles.length > INITIAL_ARTICLE_COUNT;

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
            <>
              <ul className="space-y-2">
                {visibleArticles.map((article, i) => (
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
              {hasMore && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  {showAll ? "Show less" : `Show ${category.articles.length - INITIAL_ARTICLE_COUNT} more`}
                </button>
              )}
            </>
          )}
        </div>
      )}
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
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          Customize Sections
        </h3>
        <button
          onClick={onClose}
          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
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
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                enabled
                  ? "bg-zinc-50 text-zinc-900 dark:bg-zinc-700/50 dark:text-zinc-100"
                  : "text-zinc-400 dark:text-zinc-500"
              } ${isLastEnabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
            >
              <input
                type="checkbox"
                checked={enabled}
                disabled={isLastEnabled}
                onChange={() => onToggle(id)}
                className="h-3.5 w-3.5 rounded border-zinc-300 text-zinc-900 accent-zinc-900 dark:border-zinc-600 dark:accent-zinc-100"
              />
              {SECTION_LABELS[id]}
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
        At least 1 section required. Max 5.
      </p>
    </div>
  );
}

export function MacroDashboard() {
  const [data, setData] = useState<MacroNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [enabledSections, setEnabledSections] = useState<string[]>(ALL_SECTIONS);
  const [showSettings, setShowSettings] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);

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

  const filteredCategories = data.categories.filter((cat) =>
    enabledSections.includes(cat.id)
  );

  return (
    <div className="space-y-4">
      {/* Macro Outlook Hero */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Macro Outlook
          </h2>
          <div className="flex items-center gap-3">
            {data.generatedAt && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                Updated {timeAgo(data.generatedAt)}
              </span>
            )}
            <button
              onClick={() => setShowSettings((v) => !v)}
              className={`rounded-md p-1.5 transition-colors ${
                showSettings
                  ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                  : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
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
        <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {data.macroOutlook || "Insufficient data for analysis."}
        </p>
      </div>

      {/* Section Settings Panel */}
      {showSettings && (
        <SectionSettings
          enabledSections={enabledSections}
          onToggle={handleToggle}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Category Sections */}
      {filteredCategories.map((cat) => (
        <CategorySection key={cat.id} category={cat} />
      ))}
    </div>
  );
}
