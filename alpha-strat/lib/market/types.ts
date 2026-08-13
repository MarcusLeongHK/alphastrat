export interface QuoteData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  pe?: number;
  timestamp: number;
}

export interface HistoricalBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface EarningsData {
  ticker: string;
  earningsDate: string | null;
  epsEstimate: number | null;
  epsHigh: number | null;
  epsLow: number | null;
  revenueEstimate: number | null;
  revenueHigh: number | null;
  revenueLow: number | null;
  marketCap: number | null;
}

export interface AnalystData {
  ticker: string;
  recommendationKey: string | null; // "buy", "hold", "sell", "strong_buy", "underperform", etc.
  recommendationMean: number | null; // 1.0 (strong buy) to 5.0 (strong sell)
  numberOfAnalysts: number | null;
  targetMeanPrice: number | null;
  targetHighPrice: number | null;
  targetLowPrice: number | null;
}

export interface NewsArticle {
  title: string;
  publisher: string;
  link: string;
  publishedAt: string; // ISO date
  summary?: string;
}

export interface TickerNews {
  ticker: string;
  articles: NewsArticle[];
  aiSummary: string | null;
}

export interface StockTwitsSentiment {
  ticker: string;
  bullish: number;
  bearish: number;
  messageCount: number;
  sentiment: "bullish" | "bearish" | "neutral" | null;
}

export interface RecommendationPeriod {
  period: string; // "0m" = current, "-1m" = last month, etc.
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
