"use client";

interface AiSummaryCardProps {
  summary: string | null;
  loading: boolean;
  error?: string | null;
}

export function AiSummaryCard({ summary, loading, error }: AiSummaryCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        <span aria-hidden="true">✨</span>
        AI Analysis
      </h2>

      {loading ? (
        <div className="flex flex-col gap-2">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-full animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-3 w-2/3 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      ) : error ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">
          AI analysis is unavailable right now.
        </p>
      ) : !summary ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Add positions to generate an AI analysis of your portfolio.
        </p>
      ) : (
        <p className="text-base italic leading-relaxed text-zinc-700 dark:text-zinc-300">
          {summary}
        </p>
      )}
    </div>
  );
}
