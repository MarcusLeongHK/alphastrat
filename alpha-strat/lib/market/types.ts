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
