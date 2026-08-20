"use client";

import { Card } from "@/app/components/ui/card";
import { Skeleton } from "@/app/components/ui/skeleton";

interface AiSummaryCardProps {
  summary: string | null;
  loading: boolean;
  error?: string | null;
}

export function AiSummaryCard({ summary, loading, error }: AiSummaryCardProps) {
  return (
    <Card>
      <h2 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-text-primary">
        <span aria-hidden="true">✨</span>
        AI Analysis
      </h2>

      {loading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ) : error ? (
        <p className="text-sm text-text-tertiary">
          AI analysis is unavailable right now.
        </p>
      ) : !summary ? (
        <p className="text-sm text-text-secondary">
          Add positions to generate an AI analysis of your portfolio.
        </p>
      ) : (
        <p className="text-base italic leading-relaxed text-text-secondary">
          {summary}
        </p>
      )}
    </Card>
  );
}
