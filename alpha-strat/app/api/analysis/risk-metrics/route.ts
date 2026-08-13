import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getHistorical } from "@/lib/market/yahoo";
import { PRICE_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { calcBeta, calcSharpeRatio } from "@/lib/finance/risk";
import { HistoricalBar } from "@/lib/market/types";

const RISK_FREE_RATE_ANNUAL = 0.05;
const RISK_FREE_RATE_DAILY = RISK_FREE_RATE_ANNUAL / 252;

function dailyReturns(bars: HistoricalBar[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const prevClose = bars[i - 1].close;
    const close = bars[i].close;
    if (prevClose > 0) {
      returns.push((close - prevClose) / prevClose);
    }
  }
  return returns;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "Missing required query param: tickers" },
      { status: 400 }
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Missing required query param: tickers" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    async function fetchBars(ticker: string): Promise<HistoricalBar[]> {
      const { data } = await getOrFetch<HistoricalBar[]>(
        supabase,
        `history:${ticker}:1y`,
        "history",
        PRICE_TTL,
        () => getHistorical(ticker, "1y")
      );
      return data;
    }

    const [benchmarkBars, ...tickerBarsList] = await Promise.all([
      fetchBars("SPY"),
      ...tickers.map((ticker) => fetchBars(ticker)),
    ]);

    const benchmarkReturns = dailyReturns(benchmarkBars);

    const perTicker: Record<string, { beta: number }> = {};
    const allTickerReturns: number[][] = [];

    tickers.forEach((ticker, i) => {
      const bars = tickerBarsList[i];
      const returns = dailyReturns(bars);
      allTickerReturns.push(returns);

      const len = Math.min(returns.length, benchmarkReturns.length);
      const beta = calcBeta(
        returns.slice(returns.length - len),
        benchmarkReturns.slice(benchmarkReturns.length - len)
      );

      perTicker[ticker] = { beta };
    });

    const minLength = Math.min(...allTickerReturns.map((r) => r.length));
    const portfolioReturns: number[] = [];
    for (let i = 0; i < minLength; i++) {
      const dayReturns = allTickerReturns.map(
        (returns) => returns[returns.length - minLength + i]
      );
      const avg =
        dayReturns.reduce((sum, r) => sum + r, 0) / dayReturns.length;
      portfolioReturns.push(avg);
    }

    const portfolioBetaLen = Math.min(
      portfolioReturns.length,
      benchmarkReturns.length
    );
    const beta = calcBeta(
      portfolioReturns.slice(portfolioReturns.length - portfolioBetaLen),
      benchmarkReturns.slice(benchmarkReturns.length - portfolioBetaLen)
    );

    const sharpe = calcSharpeRatio(portfolioReturns, RISK_FREE_RATE_DAILY);

    return NextResponse.json({
      metrics: { beta, sharpe },
      perTicker,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to compute risk metrics: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
