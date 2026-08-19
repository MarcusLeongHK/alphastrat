"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ThesisData } from "./types";
import { timeAgo } from "./utils";

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
  );
}
