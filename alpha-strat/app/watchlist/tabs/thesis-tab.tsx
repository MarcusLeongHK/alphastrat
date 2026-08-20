"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThesisData } from "./types";
import { timeAgo } from "./utils";
import { Card } from "@/app/components/ui/card";
import { Badge } from "@/app/components/ui/badge";
import { Skeleton } from "@/app/components/ui/skeleton";

function thesisRatingColor(rating: string): string {
  if (rating === "Strong Buy" || rating === "Buy") return "text-success";
  if (rating === "Hold") return "text-warning";
  return "text-danger";
}

function thesisRatingBadgeVariant(rating: string): "bullish" | "bearish" | "mixed" {
  if (rating === "Strong Buy" || rating === "Buy") return "bullish";
  if (rating === "Hold") return "mixed";
  return "bearish";
}

function thesisRatingBg(rating: string): string {
  if (rating === "Strong Buy" || rating === "Buy") return "bg-success/10 border-success/30";
  if (rating === "Hold") return "bg-warning/10 border-warning/30";
  return "bg-danger/10 border-danger/30";
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
      <div className="relative h-2 rounded-full bg-gradient-to-r from-danger via-warning to-success">
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct}%` }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-surface-primary bg-accent shadow" />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between">
        {RATING_LABELS_FULL.map((label, i) => (
          <span
            key={label}
            className={`text-[9px] md:text-[10px] ${
              i === position
                ? "font-semibold text-text-primary"
                : "text-text-tertiary"
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
      <span className="text-[10px] text-success">Bull</span>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full">
        <div className="bg-success" style={{ width: `${bull}%` }} />
        <div className="bg-danger" style={{ width: `${bear}%` }} />
      </div>
      <span className="text-[10px] text-danger">Bear</span>
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
      borderColor: "border-l-success",
      labelColor: "text-success",
      summary: thesisData.bullSummary || thesisData.bullCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.bullCase,
    },
    {
      key: "bear",
      label: "Bear Case",
      borderColor: "border-l-danger",
      labelColor: "text-danger",
      summary: thesisData.bearSummary || thesisData.bearCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.bearCase,
    },
    {
      key: "base",
      label: "Base Case",
      borderColor: "border-l-warning",
      labelColor: "text-warning",
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
            className={`rounded-lg border border-l-4 border-border-primary ${c.borderColor}`}
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
                  <p className="mt-0.5 text-sm text-text-secondary line-clamp-1">
                    {c.summary}
                  </p>
                )}
              </div>
              <svg
                className={`ml-2 h-4 w-4 shrink-0 text-text-tertiary transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isExpanded && (
              <div className="border-t border-border-primary px-4 pb-4 pt-3">
                <p className="text-sm leading-relaxed text-text-primary">
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

interface ThesisTabProps {
  ticker: string;
}

export function ThesisTab({ ticker }: ThesisTabProps) {
  const [thesisData, setThesisData] = useState<ThesisData | null>(null);
  const [thesisFetched, setThesisFetched] = useState(false);
  const [thesisError, setThesisError] = useState(false);
  const [thesisRefreshing, setThesisRefreshing] = useState(false);
  const refreshTickerRef = useRef(ticker);

  const thesisLoading = !thesisFetched;

  useEffect(() => {
    refreshTickerRef.current = ticker;
  }, [ticker]);

  useEffect(() => {
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
  }, [ticker]);

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

  return (
    <div className="flex flex-col gap-4">
      {thesisLoading || thesisRefreshing ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : thesisError ? (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-xs text-text-tertiary">Unable to generate thesis. Try again later.</p>
          <button
            onClick={handleThesisRefresh}
            className="rounded-md bg-surface-tertiary px-3 py-1 text-xs font-medium text-text-secondary hover:bg-border-secondary"
          >
            Retry
          </button>
        </div>
      ) : thesisData ? (
        <>
          {/* Rating Gauge */}
          <div className={`rounded-lg border p-4 ${thesisRatingBg(thesisData.rating)}`}>
            <div className="flex items-baseline justify-between mb-3">
              <Badge variant={thesisRatingBadgeVariant(thesisData.rating)} size="md">
                <span className={`text-xl font-bold ${thesisRatingColor(thesisData.rating)}`}>
                  {thesisData.rating}
                </span>
              </Badge>
              <span className="text-[10px] text-text-tertiary">
                Investment Rating
              </span>
            </div>
            <RatingGauge rating={thesisData.rating} />
            <p className="mt-3 text-sm text-text-secondary">
              {thesisData.ratingRationale}
            </p>
            <div className="mt-3">
              <VerdictBar rating={thesisData.rating} />
            </div>
          </div>

          {/* Key Metrics Grid */}
          {thesisData.keyMetrics.length > 0 && (
            <Card padding="p-3">
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Key Metrics
              </h4>
              <div className="grid grid-cols-2 gap-3">
                {thesisData.keyMetrics.map((metric, i) => (
                  <div key={i} className="flex flex-col">
                    <span className="text-[10px] text-text-tertiary">
                      {metric.label}
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {metric.value}
                    </span>
                    <span className="text-[10px] text-text-tertiary">
                      {metric.context}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Bull/Bear/Base Accordion */}
          <CaseAccordion thesisData={thesisData} />

          {/* Footer */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-text-tertiary">
              Generated {timeAgo(thesisData.generatedAt)}
            </span>
            <button
              onClick={handleThesisRefresh}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
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
  );
}
