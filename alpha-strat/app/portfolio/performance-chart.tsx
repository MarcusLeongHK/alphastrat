"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

interface PerformanceChartProps {
  positions: { ticker: string; quantity: number }[];
}

type Range = "1m" | "3m" | "6m" | "1y";

const RANGES: { value: Range; label: string }[] = [
  { value: "1m", label: "1M" },
  { value: "3m", label: "3M" },
  { value: "6m", label: "6M" },
  { value: "1y", label: "1Y" },
];

const COMPARE_COLORS = ["#7c3aed", "#db2777", "#ea580c", "#16a34a"];
const MAX_COMPARE = 4;

type ChartRow = { date: string } & Record<string, string | number>;

type TickerSuggestion = {
  symbol: string;
  name: string;
};

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <p className="font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
      {payload.map((item) => (
        <p
          key={item.dataKey}
          className="tabular-nums text-zinc-500 dark:text-zinc-400"
          style={{ color: item.color }}
        >
          {item.dataKey === "portfolio" ? "Portfolio" : item.dataKey}:{" "}
          {item.value >= 0 ? "+" : ""}
          {item.value.toFixed(2)}%
        </p>
      ))}
    </div>
  );
}

function formatDateTick(date: string, range: Range) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  if (range === "1y") {
    return d.toLocaleDateString(undefined, { month: "short" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
}

export function PerformanceChart({ positions }: PerformanceChartProps) {
  const [range, setRange] = useState<Range>("1y");
  const [compareInput, setCompareInput] = useState("");
  const [compareTickers, setCompareTickers] = useState<string[]>([]);
  const [chartData, setChartData] = useState<ChartRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [compareSuggestions, setCompareSuggestions] = useState<
    TickerSuggestion[]
  >([]);
  const [showCompareSuggestions, setShowCompareSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tickersKey = useMemo(
    () => positions.map((p) => p.ticker).join(","),
    [positions]
  );
  const quantitiesKey = useMemo(
    () => positions.map((p) => p.quantity).join(","),
    [positions]
  );
  const compareKey = useMemo(
    () => compareTickers.join(","),
    [compareTickers]
  );

  useEffect(() => {
    if (positions.length === 0) return;

    let cancelled = false;

    const url = `/api/portfolio/performance?tickers=${tickersKey}&quantities=${quantitiesKey}&range=${range}&compare=${compareKey}`;

    fetch(url)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Failed to fetch performance data");
        }
        return res.json() as Promise<{ data: ChartRow[] }>;
      })
      .then((body) => {
        if (!cancelled) {
          setChartData(body.data);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to fetch performance data"
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [positions.length, tickersKey, quantitiesKey, range, compareKey]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function handleRangeChange(next: Range) {
    setChartData(null);
    setRange(next);
  }

  function addCompareTicker(rawTicker: string) {
    const ticker = rawTicker.trim().toUpperCase();
    if (!ticker) return;
    setCompareSuggestions([]);
    setShowCompareSuggestions(false);
    if (compareTickers.includes(ticker)) {
      setCompareInput("");
      return;
    }
    if (compareTickers.length >= MAX_COMPARE) return;
    setChartData(null);
    setCompareTickers([...compareTickers, ticker]);
    setCompareInput("");
  }

  function handleAddCompare() {
    addCompareTicker(compareInput);
  }

  function handleRemoveCompare(ticker: string) {
    setChartData(null);
    setCompareTickers(compareTickers.filter((t) => t !== ticker));
  }

  function handleCompareInputChange(value: string) {
    setCompareInput(value);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 1) {
      setCompareSuggestions([]);
      setShowCompareSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/market/search?q=${encodeURIComponent(value.trim())}`
        );
        if (!res.ok) {
          setCompareSuggestions([]);
          return;
        }
        const data = await res.json();
        const results: TickerSuggestion[] = data.results ?? [];
        setCompareSuggestions(results);
        setShowCompareSuggestions(results.length > 0);
      } catch {
        setCompareSuggestions([]);
      }
    }, 300);
  }

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Portfolio Performance
        </h3>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 flex">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => handleRangeChange(r.value)}
              className={`px-3 py-1 text-xs font-medium ${
                range === r.value
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4">
        {positions.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Add positions to see portfolio performance.
          </p>
        ) : loading || !chartData ? (
          <div
            className="animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
            style={{ height: 350 }}
          />
        ) : error ? (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : (
          <div style={{ width: "100%", height: 350 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(date: string) => formatDateTick(date, range)}
                  tick={{ fontSize: 11 }}
                  stroke="#a1a1aa"
                />
                <YAxis
                  tickFormatter={(v: number) => `${v}%`}
                  tick={{ fontSize: 11 }}
                  stroke="#a1a1aa"
                />
                <Tooltip content={<CustomTooltip />} />
                {compareTickers.length > 0 && <Legend />}
                <Line
                  type="monotone"
                  dataKey="portfolio"
                  name="Portfolio"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={false}
                />
                {compareTickers.map((ticker, i) => (
                  <Line
                    key={ticker}
                    type="monotone"
                    dataKey={ticker}
                    name={ticker}
                    stroke={COMPARE_COLORS[i % COMPARE_COLORS.length]}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {positions.length > 0 && (
        <div className="mt-4">
          <div className="relative flex gap-2">
            <input
              type="text"
              value={compareInput}
              onChange={(e) => handleCompareInputChange(e.target.value)}
              onFocus={() => {
                if (compareSuggestions.length > 0) {
                  setShowCompareSuggestions(true);
                }
              }}
              onBlur={() => {
                blurTimeoutRef.current = setTimeout(() => {
                  setShowCompareSuggestions(false);
                }, 150);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (showCompareSuggestions && compareSuggestions.length > 0) {
                    addCompareTicker(compareSuggestions[0].symbol);
                  } else {
                    handleAddCompare();
                  }
                }
              }}
              placeholder="Compare to... (e.g. SPY)"
              disabled={compareTickers.length >= MAX_COMPARE}
              autoComplete="off"
              className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleAddCompare}
              disabled={compareTickers.length >= MAX_COMPARE}
              className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
            >
              Add
            </button>
            {showCompareSuggestions && compareSuggestions.length > 0 && (
              <div
                className="absolute z-10 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
                style={{ top: "100%", left: 0, right: 0, marginTop: "0.25rem" }}
              >
                {compareSuggestions.map((suggestion) => (
                  <button
                    key={suggestion.symbol}
                    type="button"
                    onClick={() => addCompareTicker(suggestion.symbol)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                      {suggestion.symbol}
                    </span>
                    <span className="truncate text-zinc-500 dark:text-zinc-400">
                      {suggestion.name}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {compareTickers.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {compareTickers.map((ticker) => (
                <span
                  key={ticker}
                  className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-3 py-1 text-xs font-medium flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300"
                >
                  {ticker}
                  <button
                    type="button"
                    onClick={() => handleRemoveCompare(ticker)}
                    aria-label={`Remove ${ticker}`}
                    className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
