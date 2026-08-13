const ADANOS_BASE = "https://api.adanos.org";

export interface AdanosSentiment {
  ticker: string;
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
  totalUpvotes: number;
  uniquePosts: number;
  subredditCount: number;
  periodDays: number;
  dailyTrend: {
    date: string;
    mentions: number;
    sentimentScore: number;
    buzzScore: number;
  }[];
  topSubreddits: {
    subreddit: string;
    mentions: number;
    sentimentScore: number;
    buzzScore: number;
  }[];
}

export async function getAdanosSentiment(
  ticker: string
): Promise<AdanosSentiment | null> {
  const apiKey = process.env.ADANOS_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch(
      `${ADANOS_BASE}/reddit/stocks/v1/stock/${encodeURIComponent(ticker)}`,
      { headers: { "X-API-Key": apiKey } }
    );

    if (!res.ok) {
      console.warn(
        `[adanos] Fetch for ${ticker} returned HTTP ${res.status} ${res.statusText}`
      );
      return null;
    }

    const data = await res.json();
    if (!data.found) return null;

    return {
      ticker: data.ticker,
      found: data.found,
      buzzScore: data.buzz_score ?? 0,
      trend: data.trend ?? "unknown",
      mentions: data.mentions ?? 0,
      sentimentScore: data.sentiment_score ?? 0,
      bullishPct: data.bullish_pct ?? 0,
      bearishPct: data.bearish_pct ?? 0,
      totalUpvotes: data.total_upvotes ?? 0,
      uniquePosts: data.unique_posts ?? 0,
      subredditCount: data.subreddit_count ?? 0,
      periodDays: data.period_days ?? 7,
      dailyTrend: (data.daily_trend ?? []).map(
        (d: Record<string, unknown>) => ({
          date: d.date as string,
          mentions: (d.mentions as number) ?? 0,
          sentimentScore: (d.sentiment_score as number) ?? 0,
          buzzScore: (d.buzz_score as number) ?? 0,
        })
      ),
      topSubreddits: (data.top_subreddits ?? []).map(
        (s: Record<string, unknown>) => ({
          subreddit: s.subreddit as string,
          mentions: (s.mentions as number) ?? 0,
          sentimentScore: (s.sentiment_score as number) ?? 0,
          buzzScore: (s.buzz_score as number) ?? 0,
        })
      ),
    };
  } catch (err) {
    console.warn(
      `[adanos] Fetch for ${ticker} threw:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}
