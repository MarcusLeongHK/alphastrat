import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { OPTIONS_TTL, THESIS_TTL } from "@/lib/cache/freshness";
import { getAllNearTermChains, getRiskFreeRate } from "@/lib/market/yahoo-options";
import { getHistorical, getTickerFundamentals } from "@/lib/market/yahoo";
import {
  computeOptionsSignals,
  ivSurface,
} from "@/lib/finance/options-analysis";
import { generateOptionsAnalysis } from "@/lib/ai/options-analysis";
import type { OptionsAnalysisResponse } from "@/lib/market/types-options";
import type { TickerFundamentals } from "@/lib/market/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticker = request.nextUrl.searchParams
      .get("ticker")
      ?.trim()
      .toUpperCase();
    if (!ticker) {
      return NextResponse.json(
        { error: "ticker parameter is required" },
        { status: 400 }
      );
    }

    const { data } = await getOrFetch<OptionsAnalysisResponse>(
      supabase,
      `options-analysis-${ticker}`,
      "options-analysis",
      OPTIONS_TTL,
      async () => {
        // Fetch all data in parallel
        const [snapshot, rfr, historical, fundamentals] = await Promise.all([
          getAllNearTermChains(ticker),
          getRiskFreeRate(supabase),
          getHistorical(ticker, "3mo").catch(() => []),
          getOrFetch<TickerFundamentals>(
            supabase,
            `fundamentals-${ticker}`,
            "fundamentals",
            THESIS_TTL,
            () => getTickerFundamentals(ticker),
            { shared: true }
          )
            .then((r) => r.data)
            .catch(() => null),
        ]);

        const priceHistory = historical.map((bar) => bar.close);
        const signals = computeOptionsSignals(snapshot, rfr, priceHistory);
        const surface = ivSurface(snapshot.chains, snapshot.underlyingPrice);

        const quoteContext = {
          price: snapshot.underlyingPrice,
          fiftyTwoWeekHigh: fundamentals?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: fundamentals?.fiftyTwoWeekLow ?? null,
        };

        const fundamentalsContext = fundamentals
          ? {
              nextEarningsDate: fundamentals.nextEarningsDate,
              consensusEps:
                fundamentals.earningsTrend.find((e) => e.period === "0q")
                  ?.epsEstimate ?? null,
            }
          : null;

        const analysis = await generateOptionsAnalysis(
          ticker,
          signals,
          quoteContext,
          fundamentalsContext
        );

        // Build positioning data for nearest expiry, limited to strikes
        // within 15% of spot so the payload stays chart-sized.
        const nearest = snapshot.chains[0];
        const positioning = nearest
          ? [
              ...new Set([
                ...nearest.calls.map((c) => c.strike),
                ...nearest.puts.map((p) => p.strike),
              ]),
            ]
              .sort((a, b) => a - b)
              .filter((strike) => {
                const pct =
                  Math.abs(strike - snapshot.underlyingPrice) /
                  snapshot.underlyingPrice;
                return pct <= 0.15;
              })
              .map((strike) => ({
                strike,
                callVolume:
                  nearest.calls.find((c) => c.strike === strike)?.volume ?? 0,
                putVolume:
                  nearest.puts.find((p) => p.strike === strike)?.volume ?? 0,
                callOI:
                  nearest.calls.find((c) => c.strike === strike)
                    ?.openInterest ?? 0,
                putOI:
                  nearest.puts.find((p) => p.strike === strike)
                    ?.openInterest ?? 0,
              }))
          : [];

        return {
          ticker,
          underlyingPrice: snapshot.underlyingPrice,
          signals,
          analysis,
          ivSurface: surface,
          ivTermStructure: signals.termStructure,
          positioning,
          expectedMove: signals.expectedMove,
          maxPain: signals.maxPain,
          putCallRatio: signals.putCallRatio,
        } satisfies OptionsAnalysisResponse;
      },
      { shared: true }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch options analysis: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
