export interface NewsArticle {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string;
  summary?: string;
}

export interface NewsTheme {
  label: string;
  summary: string;
  detail: string;
  articleIndices: number[];
}

export interface TickerNews {
  ticker: string;
  articles: NewsArticle[];
  aiSummary: string | null;
  themes?: NewsTheme[] | null;
}

export interface RecommendationPeriod {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
}

export interface RecommendationTrend {
  ticker: string;
  trend: RecommendationPeriod[];
}

export interface AdanosSource {
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
  periodDays: number;
  totalUpvotes?: number;
  uniquePosts?: number;
  uniqueTweets?: number;
  topSubreddits?: { subreddit: string; mentions: number }[];
  topTweets?: { textSnippet: string; sentimentLabel: string; likes: number; retweets: number; author: string }[];
}

export interface SocialSentimentData {
  ticker: string;
  reddit: AdanosSource | null;
  twitter: AdanosSource | null;
  news: AdanosSource | null;
  polymarket: AdanosSource | null;
  comparison: string | null;
  explain: { ticker: string; explanation: string; generatedAt: string } | null;
}

export interface ThesisKeyMetric {
  label: string;
  value: string;
  context: string;
}

export interface ThesisData {
  ticker: string;
  rating: string;
  ratingRationale: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  bullSummary?: string;
  bearSummary?: string;
  baseSummary?: string;
  keyMetrics: ThesisKeyMetric[];
  generatedAt: string;
}

export interface EarningsTrendEntry {
  period: string;
  epsEstimate: number | null;
  epsGrowth: number | null;
  revenueEstimate: number | null;
  revenueGrowth: number | null;
}

export interface EarningsHistoryEntry {
  quarter: string;
  epsActual: number | null;
  epsEstimate: number | null;
  surprisePercent: number | null;
}

export interface QuarterlyRevenueEntry {
  quarter: string;
  revenue: number | null;
  netIncome: number | null;
}

export interface EarningsDetailData {
  ticker: string;
  earningsHistory: EarningsHistoryEntry[];
  earningsTrend: EarningsTrendEntry[];
  quarterlyRevenue: QuarterlyRevenueEntry[];
  nextEarningsDate: string | null;
  nextEpsEstimate: number | null;
  nextRevenueEstimate: number | null;
}

export interface OptionsAnalysisData {
  ticker: string;
  underlyingPrice: number;
  signals: {
    expectedMove: { dollars: number; percent: number; upperBound: number; lowerBound: number };
    putCallRatio: number;
    ivSkew: { direction: string; magnitude: number };
    maxPain: number;
    atmIv: number;
    historicalVolatility: number;
    unusualActivity: Array<{
      strike: number;
      expiry: string;
      type: string;
      volume: number;
      openInterest: number;
      volumeOiRatio: number;
    }>;
    termStructure: Array<{ expiry: string; daysToExpiry: number; atmIv: number }>;
    greeksSummary: { atmDelta: number; atmGamma: number; atmTheta: number; atmVega: number };
  };
  analysis: {
    marketPositioning: string;
    expectedMoveAnalysis: string;
    volatilityAssessment: string;
    notableFlow: string;
    keyRisksAndCatalysts: string;
    actionableTakeaway: string;
  };
  ivSurface: Array<{ moneyness: number; iv: number; expiry: string }>;
  ivTermStructure: Array<{ expiry: string; daysToExpiry: number; atmIv: number }>;
  positioning: Array<{
    strike: number;
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
  }>;
  expectedMove: { dollars: number; percent: number; upperBound: number; lowerBound: number };
  maxPain: number;
  putCallRatio: number;
}

export type Tab = "overview" | "news" | "sentiment" | "thesis" | "earnings" | "options";
