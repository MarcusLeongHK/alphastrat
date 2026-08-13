import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getRecommendationTrend } from "@/lib/market/yahoo";
import { SENTIMENT_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { RecommendationTrend } from "@/lib/market/types";

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

    const trends: RecommendationTrend[] = await Promise.all(
      tickers.map(async (ticker) => {
        const { data } = await getOrFetch<RecommendationTrend>(
          supabase,
          `rec-trend:${ticker}`,
          "sentiment",
          SENTIMENT_TTL,
          () => getRecommendationTrend(ticker)
        );
        return data;
      })
    );

    return NextResponse.json(trends);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch sentiment: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
