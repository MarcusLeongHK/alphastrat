import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import {
  getAdanosRedditSentiment,
  getAdanosTwitterSentiment,
  getAdanosNewsSentiment,
  getAdanosPolymarketSentiment,
  getAdanosExplain,
  getAvailableSources,
  type AdanosSentiment,
  type AdanosTwitterSentiment,
  type AdanosNewsSentiment,
  type AdanosPolymarketSentiment,
  type AdanosExplanation,
} from "@/lib/market/adanos";
import { generateSentimentComparison } from "@/lib/ai/sentiment-comparison";
import { getAnalystData } from "@/lib/market/yahoo";
import { ADANOS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";

interface SocialSentimentResponse {
  ticker: string;
  reddit: AdanosSentiment | null;
  twitter: AdanosTwitterSentiment | null;
  news: AdanosNewsSentiment | null;
  polymarket: AdanosPolymarketSentiment | null;
  comparison: string | null;
  explain: AdanosExplanation | null;
}

function buildComparisonContext(
  reddit: AdanosSentiment | null,
  twitter: AdanosTwitterSentiment | null,
  news: AdanosNewsSentiment | null,
  polymarket: AdanosPolymarketSentiment | null
): string {
  const parts: string[] = [];

  if (reddit) {
    parts.push(
      `Reddit: ${reddit.bullishPct.toFixed(0)}% bullish, ${reddit.bearishPct.toFixed(0)}% bearish, ${reddit.mentions} mentions, buzz ${reddit.buzzScore.toFixed(1)}`
    );
  }
  if (twitter) {
    parts.push(
      `Twitter/X: ${twitter.bullishPct.toFixed(0)}% bullish, ${twitter.bearishPct.toFixed(0)}% bearish, ${twitter.mentions} mentions, buzz ${twitter.buzzScore.toFixed(1)}`
    );
  }
  if (news) {
    parts.push(
      `News: ${news.bullishPct.toFixed(0)}% bullish, ${news.bearishPct.toFixed(0)}% bearish, ${news.mentions} mentions across ${news.sourceCount} sources`
    );
  }
  if (polymarket) {
    parts.push(
      `Polymarket: ${polymarket.bullishPct.toFixed(0)}% bullish, ${polymarket.bearishPct.toFixed(0)}% bearish, ${polymarket.tradeCount} trades, $${(polymarket.totalLiquidity / 1000).toFixed(0)}k liquidity`
    );
  }

  return parts.length > 0
    ? `Social sentiment breakdown: ${parts.join(". ")}.`
    : "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker")?.trim().toUpperCase();

  if (!ticker) {
    return NextResponse.json(
      { error: "Missing required query param: ticker" },
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

    const { data } = await getOrFetch<SocialSentimentResponse>(
      supabase,
      `social-sentiment:${ticker}`,
      "social-sentiment",
      ADANOS_TTL,
      async () => {
        const sources = getAvailableSources();

        const [reddit, twitter, news, polymarket, analyst, explain] = await Promise.all([
          sources.includes("reddit") ? getAdanosRedditSentiment(ticker) : Promise.resolve(null),
          sources.includes("twitter") ? getAdanosTwitterSentiment(ticker) : Promise.resolve(null),
          sources.includes("news") ? getAdanosNewsSentiment(ticker) : Promise.resolve(null),
          sources.includes("polymarket") ? getAdanosPolymarketSentiment(ticker) : Promise.resolve(null),
          getAnalystData(ticker),
          getAdanosExplain(ticker),
        ]);

        let comparison: string | null = null;
        const context = buildComparisonContext(reddit, twitter, news, polymarket);
        if (context && analyst.recommendationKey) {
          comparison = await generateSentimentComparison(
            ticker,
            analyst.recommendationKey.replace("_", " "),
            analyst.numberOfAnalysts ?? 0,
            context
          );
        }

        return { ticker, reddit, twitter, news, polymarket, comparison, explain };
      },
      {
        shouldCache: (result) =>
          !!(result.reddit || result.twitter || result.news || result.polymarket),
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch social sentiment: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
