const ADANOS_BASE = "https://api.adanos.org";

let keyIndex = 0;

function getNextApiKey(): string | null {
  const raw = process.env.ADANOS_API_KEY;
  if (!raw) return null;
  const keys = raw.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) return null;
  const key = keys[keyIndex % keys.length];
  keyIndex++;
  return key;
}

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

export interface AdanosTwitterSentiment {
  ticker: string;
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
  totalUpvotes: number;
  uniqueTweets: number;
  periodDays: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  dailyTrend: {
    date: string;
    mentions: number;
    sentimentScore: number;
    buzzScore: number;
  }[];
  topTweets: {
    textSnippet: string;
    sentimentLabel: string;
    likes: number;
    retweets: number;
    author: string;
  }[];
}

export interface AdanosNewsSentiment {
  ticker: string;
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
  sourceCount: number;
  periodDays: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  dailyTrend: {
    date: string;
    mentions: number;
    sentimentScore: number;
    buzzScore: number;
  }[];
  topSources: {
    source: string;
    mentions: number;
    sentimentScore: number;
    buzzScore: number;
  }[];
}

export interface AdanosPolymarketSentiment {
  ticker: string;
  found: boolean;
  buzzScore: number;
  trend: string;
  periodDays: number;
  tradeCount: number;
  marketCount: number;
  uniqueTraders: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
  totalLiquidity: number;
  positiveCount: number;
  negativeCount: number;
  neutralCount: number;
  dailyTrend: {
    date: string;
    mentions: number;
    sentimentScore: number;
    buzzScore: number;
  }[];
}

async function adanosFetch(path: string): Promise<Record<string, unknown> | null> {
  const apiKey = getNextApiKey();
  if (!apiKey) return null;

  try {
    const res = await fetch(`${ADANOS_BASE}${path}`, {
      headers: { "X-API-Key": apiKey },
    });

    if (!res.ok) {
      console.warn(`[adanos] ${path} returned HTTP ${res.status} ${res.statusText}`);
      return null;
    }

    const data = await res.json();
    if (data.found === false) return null;
    return data;
  } catch (err) {
    console.warn(
      `[adanos] ${path} threw:`,
      err instanceof Error ? err.message : err
    );
    return null;
  }
}

export async function getAdanosRedditSentiment(
  ticker: string
): Promise<AdanosSentiment | null> {
  const data = await adanosFetch(`/reddit/stocks/v1/stock/${encodeURIComponent(ticker)}`);
  if (!data) return null;

  return {
    ticker: data.ticker as string,
    found: true,
    buzzScore: (data.buzz_score as number) ?? 0,
    trend: (data.trend as string) ?? "unknown",
    mentions: (data.mentions as number) ?? 0,
    sentimentScore: (data.sentiment_score as number) ?? 0,
    bullishPct: (data.bullish_pct as number) ?? 0,
    bearishPct: (data.bearish_pct as number) ?? 0,
    totalUpvotes: (data.total_upvotes as number) ?? 0,
    uniquePosts: (data.unique_posts as number) ?? 0,
    subredditCount: (data.subreddit_count as number) ?? 0,
    periodDays: (data.period_days as number) ?? 7,
    dailyTrend: ((data.daily_trend as Record<string, unknown>[]) ?? []).map((d) => ({
      date: d.date as string,
      mentions: (d.mentions as number) ?? 0,
      sentimentScore: (d.sentiment_score as number) ?? 0,
      buzzScore: (d.buzz_score as number) ?? 0,
    })),
    topSubreddits: ((data.top_subreddits as Record<string, unknown>[]) ?? []).map((s) => ({
      subreddit: s.subreddit as string,
      mentions: (s.mentions as number) ?? 0,
      sentimentScore: (s.sentiment_score as number) ?? 0,
      buzzScore: (s.buzz_score as number) ?? 0,
    })),
  };
}

export async function getAdanosTwitterSentiment(
  ticker: string
): Promise<AdanosTwitterSentiment | null> {
  const data = await adanosFetch(`/x/stocks/v1/stock/${encodeURIComponent(ticker)}`);
  if (!data) return null;

  return {
    ticker: data.ticker as string,
    found: true,
    buzzScore: (data.buzz_score as number) ?? 0,
    trend: (data.trend as string) ?? "unknown",
    mentions: (data.mentions as number) ?? 0,
    sentimentScore: (data.sentiment_score as number) ?? 0,
    bullishPct: (data.bullish_pct as number) ?? 0,
    bearishPct: (data.bearish_pct as number) ?? 0,
    totalUpvotes: (data.total_upvotes as number) ?? 0,
    uniqueTweets: (data.unique_tweets as number) ?? 0,
    periodDays: (data.period_days as number) ?? 7,
    positiveCount: (data.positive_count as number) ?? 0,
    negativeCount: (data.negative_count as number) ?? 0,
    neutralCount: (data.neutral_count as number) ?? 0,
    dailyTrend: ((data.daily_trend as Record<string, unknown>[]) ?? []).map((d) => ({
      date: d.date as string,
      mentions: (d.mentions as number) ?? 0,
      sentimentScore: (d.sentiment_score as number) ?? 0,
      buzzScore: (d.buzz_score as number) ?? 0,
    })),
    topTweets: ((data.top_tweets as Record<string, unknown>[]) ?? []).slice(0, 5).map((t) => ({
      textSnippet: (t.text_snippet as string) ?? "",
      sentimentLabel: (t.sentiment_label as string) ?? "neutral",
      likes: (t.likes as number) ?? 0,
      retweets: (t.retweets as number) ?? 0,
      author: (t.author as string) ?? "",
    })),
  };
}

export async function getAdanosNewsSentiment(
  ticker: string
): Promise<AdanosNewsSentiment | null> {
  const data = await adanosFetch(`/news/stocks/v1/stock/${encodeURIComponent(ticker)}`);
  if (!data) return null;

  return {
    ticker: data.ticker as string,
    found: true,
    buzzScore: (data.buzz_score as number) ?? 0,
    trend: (data.trend as string) ?? "unknown",
    mentions: (data.mentions as number) ?? 0,
    sentimentScore: (data.sentiment_score as number) ?? 0,
    bullishPct: (data.bullish_pct as number) ?? 0,
    bearishPct: (data.bearish_pct as number) ?? 0,
    sourceCount: (data.source_count as number) ?? 0,
    periodDays: (data.period_days as number) ?? 7,
    positiveCount: (data.positive_count as number) ?? 0,
    negativeCount: (data.negative_count as number) ?? 0,
    neutralCount: (data.neutral_count as number) ?? 0,
    dailyTrend: ((data.daily_trend as Record<string, unknown>[]) ?? []).map((d) => ({
      date: d.date as string,
      mentions: (d.mentions as number) ?? 0,
      sentimentScore: (d.sentiment_score as number) ?? 0,
      buzzScore: (d.buzz_score as number) ?? 0,
    })),
    topSources: ((data.top_sources as Record<string, unknown>[]) ?? []).map((s) => ({
      source: s.source as string,
      mentions: (s.mentions as number) ?? 0,
      sentimentScore: (s.sentiment_score as number) ?? 0,
      buzzScore: (s.buzz_score as number) ?? 0,
    })),
  };
}

export async function getAdanosPolymarketSentiment(
  ticker: string
): Promise<AdanosPolymarketSentiment | null> {
  const data = await adanosFetch(`/polymarket/stocks/v1/stock/${encodeURIComponent(ticker)}`);
  if (!data) return null;

  return {
    ticker: data.ticker as string,
    found: true,
    buzzScore: (data.buzz_score as number) ?? 0,
    trend: (data.trend as string) ?? "unknown",
    periodDays: (data.period_days as number) ?? 7,
    tradeCount: (data.trade_count as number) ?? 0,
    marketCount: (data.market_count as number) ?? 0,
    uniqueTraders: (data.unique_traders as number) ?? 0,
    sentimentScore: (data.sentiment_score as number) ?? 0,
    bullishPct: (data.bullish_pct as number) ?? 0,
    bearishPct: (data.bearish_pct as number) ?? 0,
    totalLiquidity: (data.total_liquidity as number) ?? 0,
    positiveCount: (data.positive_count as number) ?? 0,
    negativeCount: (data.negative_count as number) ?? 0,
    neutralCount: (data.neutral_count as number) ?? 0,
    dailyTrend: ((data.daily_trend as Record<string, unknown>[]) ?? []).map((d) => ({
      date: d.date as string,
      mentions: (d.mentions as number) ?? 0,
      sentimentScore: (d.sentiment_score as number) ?? 0,
      buzzScore: (d.buzz_score as number) ?? 0,
    })),
  };
}

export function getAvailableSources(): string[] {
  const raw = process.env.ADANOS_API_KEY;
  if (!raw) return [];
  return ["reddit", "twitter", "news", "polymarket"];
}

// Keep backward compat for existing code
export const getAdanosSentiment = getAdanosRedditSentiment;

export interface AdanosCompareResult {
  ticker: string;
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
}

const SOURCE_COMPARE_PATHS: Record<string, string> = {
  reddit: "/reddit/stocks/v1/compare",
  twitter: "/x/stocks/v1/compare",
  news: "/news/stocks/v1/compare",
  polymarket: "/polymarket/stocks/v1/compare",
};

export async function getAdanosCompareSentiment(
  tickers: string[],
  source: "reddit" | "twitter" | "news" | "polymarket"
): Promise<Map<string, AdanosCompareResult>> {
  const path = SOURCE_COMPARE_PATHS[source];
  if (!path) return new Map();

  const encoded = tickers.map((t) => encodeURIComponent(t)).join(",");
  const data = await adanosFetch(`${path}?tickers=${encoded}`);
  if (!data) return new Map();

  const results = new Map<string, AdanosCompareResult>();
  const items = Array.isArray(data) ? data : (data.results as Record<string, unknown>[]) ?? [];

  for (const item of items) {
    const ticker = item.ticker as string;
    if (!ticker) continue;
    results.set(ticker, {
      ticker,
      found: (item.found as boolean) ?? true,
      buzzScore: (item.buzz_score as number) ?? 0,
      trend: (item.trend as string) ?? "unknown",
      mentions: (item.mentions as number) ?? 0,
      sentimentScore: (item.sentiment_score as number) ?? 0,
      bullishPct: (item.bullish_pct as number) ?? 0,
      bearishPct: (item.bearish_pct as number) ?? 0,
    });
  }

  return results;
}

export interface AdanosTrendingTicker {
  ticker: string;
  mentions: number;
  buzzScore: number;
  sentimentScore: number;
  trend: string;
}

export interface AdanosMarketSentiment {
  overallScore: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  totalMentions: number;
  tickerCount: number;
}

export interface AdanosSectorSentiment {
  sector: string;
  sentimentScore: number;
  buzzScore: number;
  mentions: number;
  trend: string;
}

export async function getAdanosTrending(): Promise<AdanosTrendingTicker[]> {
  const data = await adanosFetch("/reddit/stocks/v1/trending");
  if (!data) return [];

  const items = Array.isArray(data) ? data : (data.trending as Record<string, unknown>[]) ?? [];
  return items.slice(0, 10).map((t) => ({
    ticker: (t.ticker as string) ?? "",
    mentions: (t.mentions as number) ?? 0,
    buzzScore: (t.buzz_score as number) ?? 0,
    sentimentScore: (t.sentiment_score as number) ?? 0,
    trend: (t.trend as string) ?? "unknown",
  }));
}

export async function getAdanosMarketSentiment(): Promise<AdanosMarketSentiment | null> {
  const data = await adanosFetch("/reddit/stocks/v1/market-sentiment");
  if (!data) return null;

  return {
    overallScore: (data.overall_score as number) ?? (data.sentiment_score as number) ?? 0,
    bullishPct: (data.bullish_pct as number) ?? 0,
    bearishPct: (data.bearish_pct as number) ?? 0,
    neutralPct: (data.neutral_pct as number) ?? 100 - ((data.bullish_pct as number) ?? 0) - ((data.bearish_pct as number) ?? 0),
    totalMentions: (data.total_mentions as number) ?? 0,
    tickerCount: (data.ticker_count as number) ?? 0,
  };
}

export async function getAdanosSectorTrending(): Promise<AdanosSectorSentiment[]> {
  const data = await adanosFetch("/reddit/stocks/v1/trending/sectors");
  if (!data) return [];

  const items = Array.isArray(data) ? data : (data.sectors as Record<string, unknown>[]) ?? [];
  return items.map((s) => ({
    sector: (s.sector as string) ?? (s.name as string) ?? "",
    sentimentScore: (s.sentiment_score as number) ?? 0,
    buzzScore: (s.buzz_score as number) ?? 0,
    mentions: (s.mentions as number) ?? 0,
    trend: (s.trend as string) ?? "unknown",
  }));
}
