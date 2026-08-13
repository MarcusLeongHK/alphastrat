import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getNews } from "@/lib/market/yahoo";
import { NEWS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { NewsArticle, TickerNews } from "@/lib/market/types";
import { generateNewsSummary } from "@/lib/ai/news-summary";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickerParam = searchParams.get("ticker");

  if (!tickerParam) {
    return NextResponse.json(
      { error: "Missing required query param: ticker" },
      { status: 400 }
    );
  }

  const ticker = tickerParam.trim().toUpperCase();

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

    const { data: articles } = await getOrFetch<NewsArticle[]>(
      supabase,
      `news:${ticker}`,
      "news",
      NEWS_TTL,
      () => getNews(ticker)
    );

    const { data: aiSummary } = await getOrFetch<string | null>(
      supabase,
      `news-summary:${ticker}`,
      "news-summary",
      NEWS_TTL,
      () => generateNewsSummary(ticker, articles)
    );

    const tickerNews: TickerNews = {
      ticker,
      articles,
      aiSummary,
    };

    return NextResponse.json(tickerNews);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch news: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
