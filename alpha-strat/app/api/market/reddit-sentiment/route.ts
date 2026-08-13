import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getAdanosSentiment, type AdanosSentiment } from "@/lib/market/adanos";
import { getRedditPosts } from "@/lib/market/reddit";
import { generateRedditSentiment } from "@/lib/ai/reddit-sentiment";
import { generateSentimentComparison } from "@/lib/ai/sentiment-comparison";
import { getAnalystData } from "@/lib/market/yahoo";
import { ADANOS_TTL, SENTIMENT_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";

interface SocialSentimentResponse {
  ticker: string;
  source: "adanos" | "reddit-rss";
  adanos: AdanosSentiment | null;
  redditFallback: {
    posts: { title: string; score: number; numComments: number; subreddit: string; permalink: string }[];
    aiSummary: string | null;
    postCount: number;
    totalScore: number;
    avgScore: number;
  } | null;
  comparison: string | null;
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
        const [adanos, analyst] = await Promise.all([
          getAdanosSentiment(ticker),
          getAnalystData(ticker),
        ]);

        if (adanos) {
          let comparison: string | null = null;
          if (analyst.recommendationKey) {
            const retailSummary = adanos.sentimentScore > 0.6
              ? "bullish"
              : adanos.sentimentScore < 0.4
                ? "bearish"
                : "mixed";
            comparison = await generateSentimentComparison(
              ticker,
              analyst.recommendationKey.replace("_", " "),
              analyst.numberOfAnalysts ?? 0,
              `Reddit retail sentiment is ${retailSummary} with ${adanos.bullishPct.toFixed(0)}% bullish and ${adanos.bearishPct.toFixed(0)}% bearish across ${adanos.mentions} mentions. Buzz score: ${adanos.buzzScore.toFixed(1)}, trend: ${adanos.trend}.`
            );
          }

          return {
            ticker,
            source: "adanos" as const,
            adanos,
            redditFallback: null,
            comparison,
          };
        }

        const posts = await getRedditPosts(ticker);
        const aiSummary = await generateRedditSentiment(ticker, posts);
        const totalScore = posts.reduce((sum, p) => sum + p.score, 0);

        let comparison: string | null = null;
        if (aiSummary && analyst.recommendationKey) {
          comparison = await generateSentimentComparison(
            ticker,
            analyst.recommendationKey.replace("_", " "),
            analyst.numberOfAnalysts ?? 0,
            aiSummary
          );
        }

        return {
          ticker,
          source: "reddit-rss" as const,
          adanos: null,
          redditFallback: {
            posts,
            aiSummary,
            postCount: posts.length,
            totalScore,
            avgScore: posts.length > 0 ? Math.round(totalScore / posts.length) : 0,
          },
          comparison,
        };
      },
      {
        shouldCache: (result) =>
          result.source === "adanos" || (result.redditFallback?.postCount ?? 0) > 0,
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
