import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { THESIS_TTL } from "@/lib/cache/freshness";
import { getTickerFundamentals } from "@/lib/market/yahoo";
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

    const { data: fundamentals } = await getOrFetch<TickerFundamentals>(
      supabase,
      `fundamentals-${ticker}`,
      "fundamentals",
      THESIS_TTL,
      () => getTickerFundamentals(ticker),
      { shared: true }
    );

    const currentQuarter = fundamentals.earningsTrend.find(
      (e) => e.period === "0q"
    );

    return NextResponse.json({
      ticker: fundamentals.ticker,
      earningsHistory: fundamentals.earningsHistory,
      earningsTrend: fundamentals.earningsTrend,
      quarterlyRevenue: fundamentals.quarterlyRevenue,
      nextEarningsDate: fundamentals.nextEarningsDate,
      nextEpsEstimate: currentQuarter?.epsEstimate ?? null,
      nextRevenueEstimate: currentQuarter?.revenueEstimate ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch earnings detail: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
