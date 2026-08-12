import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getHistorical } from "@/lib/market/yahoo";
import { PRICE_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { HistoricalBar } from "@/lib/market/types";

const VALID_RANGES = new Set(["1m", "3m", "6m", "1y"]);

const RANGE_TO_YAHOO: Record<string, string> = {
  "1m": "1mo",
  "3m": "3mo",
  "6m": "6mo",
  "1y": "1y",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");
  const quantitiesParam = searchParams.get("quantities");
  const rangeParam = searchParams.get("range") ?? "1y";
  const compareParam = searchParams.get("compare");

  if (!tickersParam || !quantitiesParam) {
    return NextResponse.json(
      { error: "Missing required query params: tickers, quantities" },
      { status: 400 }
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  const quantities = quantitiesParam
    .split(",")
    .map((q) => Number(q.trim()))
    .filter((q) => !Number.isNaN(q));

  if (tickers.length === 0 || quantities.length === 0) {
    return NextResponse.json(
      { error: "Missing required query params: tickers, quantities" },
      { status: 400 }
    );
  }

  if (tickers.length !== quantities.length) {
    return NextResponse.json(
      { error: "tickers and quantities must have the same length" },
      { status: 400 }
    );
  }

  const range = VALID_RANGES.has(rangeParam) ? rangeParam : "1y";

  const compareTickers = compareParam
    ? Array.from(
        new Set(
          compareParam
            .split(",")
            .map((t) => t.trim().toUpperCase())
            .filter(Boolean)
        )
      )
    : [];

  try {
    const supabase = await createClient();

    const { data: earliestRow } = await supabase
      .from("transactions")
      .select("transacted_at")
      .in("ticker", tickers)
      .order("transacted_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    const earliestTransactionDate: string | null = earliestRow?.transacted_at
      ? String(earliestRow.transacted_at).split("T")[0]
      : null;

    const yahooRange = RANGE_TO_YAHOO[range] ?? range;

    async function fetchBars(ticker: string): Promise<HistoricalBar[]> {
      const { data } = await getOrFetch<HistoricalBar[]>(
        supabase,
        `history:${ticker}:${range}`,
        "history",
        PRICE_TTL,
        () => getHistorical(ticker, yahooRange)
      );
      return data;
    }

    const positionBarsList = await Promise.all(
      tickers.map((ticker) => fetchBars(ticker))
    );

    // Find dates common to ALL position tickers.
    let commonDates: Set<string> | null = null;
    for (const bars of positionBarsList) {
      const dates: Set<string> = new Set(bars.map((b) => b.date));
      if (commonDates === null) {
        commonDates = dates;
      } else {
        const intersection: Set<string> = new Set<string>();
        for (const d of commonDates) {
          if (dates.has(d)) intersection.add(d);
        }
        commonDates = intersection;
      }
    }

    let sortedDates = Array.from(commonDates ?? new Set<string>()).sort();

    if (earliestTransactionDate) {
      sortedDates = sortedDates.filter((date) => date >= earliestTransactionDate);
    }

    if (sortedDates.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // Build close-price lookup maps per position ticker.
    const closeByTickerAndDate: Map<string, Map<string, number>> = new Map();
    tickers.forEach((ticker, i) => {
      const map = new Map<string, number>();
      for (const bar of positionBarsList[i]) {
        map.set(bar.date, bar.close);
      }
      closeByTickerAndDate.set(ticker, map);
    });

    const portfolioValues: number[] = sortedDates.map((date) => {
      let value = 0;
      tickers.forEach((ticker, i) => {
        const close = closeByTickerAndDate.get(ticker)?.get(date);
        if (close !== undefined) {
          value += quantities[i] * close;
        }
      });
      return value;
    });

    const firstPortfolioValue = portfolioValues[0];

    const data: Array<Record<string, string | number>> = sortedDates.map(
      (date, i) => ({
        date,
        portfolio:
          firstPortfolioValue > 0
            ? ((portfolioValues[i] / firstPortfolioValue) - 1) * 100
            : 0,
      })
    );

    // Fetch and merge comparison tickers, skipping any that fail.
    const compareResults = await Promise.allSettled(
      compareTickers.map(async (ticker) => {
        const bars = await fetchBars(ticker);
        return { ticker, bars };
      })
    );

    for (const result of compareResults) {
      if (result.status !== "fulfilled") continue;
      const { ticker, bars } = result.value;

      const closeByDate = new Map(bars.map((b) => [b.date, b.close]));
      const firstClose = closeByDate.get(sortedDates[0]);
      if (firstClose === undefined || firstClose === 0) continue;

      sortedDates.forEach((date, i) => {
        const close = closeByDate.get(date);
        if (close !== undefined) {
          data[i][ticker] = ((close / firstClose) - 1) * 100;
        }
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to compute portfolio performance: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
