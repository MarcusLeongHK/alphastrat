import { QuoteData, HistoricalBar, EarningsData, AnalystData, NewsArticle, RecommendationTrend, RecommendationPeriod, TickerFundamentals } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface YahooChartMeta {
  symbol?: string;
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
  marketCap?: number;
  trailingPE?: number;
}

interface YahooChartResult {
  meta: YahooChartMeta;
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      open?: (number | null)[];
      high?: (number | null)[];
      low?: (number | null)[];
      close?: (number | null)[];
      volume?: (number | null)[];
    }>;
  };
}

interface YahooChartResponse {
  chart: {
    result: YahooChartResult[] | null;
    error: { code?: string; description?: string } | null;
  };
}

async function fetchChart(
  ticker: string,
  interval: string,
  range: string
): Promise<YahooChartResult> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    ticker
  )}?interval=${interval}&range=${range}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Yahoo Finance for ticker "${ticker}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance request failed for ticker "${ticker}" with status ${response.status}`
    );
  }

  let json: YahooChartResponse;
  try {
    json = (await response.json()) as YahooChartResponse;
  } catch (err) {
    throw new Error(
      `Failed to parse Yahoo Finance response for ticker "${ticker}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (json.chart.error) {
    throw new Error(
      `Yahoo Finance returned an error for ticker "${ticker}": ${
        json.chart.error.description ?? json.chart.error.code ?? "unknown error"
      }`
    );
  }

  const result = json.chart.result?.[0];
  if (!result) {
    throw new Error(`No data returned by Yahoo Finance for ticker "${ticker}". It may be invalid.`);
  }

  return result;
}

export async function getQuote(ticker: string): Promise<QuoteData> {
  const result = await fetchChart(ticker, "1d", "1d");
  const meta = result.meta;

  const price = meta.regularMarketPrice;
  if (price === undefined || price === null) {
    throw new Error(`No price data available for ticker "${ticker}".`);
  }

  const previousClose = meta.chartPreviousClose ?? meta.previousClose;
  const change =
    previousClose !== undefined && previousClose !== null ? price - previousClose : 0;
  const changePercent =
    previousClose !== undefined && previousClose !== null && previousClose !== 0
      ? (change / previousClose) * 100
      : 0;

  return {
    ticker: meta.symbol ?? ticker,
    price,
    change,
    changePercent,
    volume: meta.regularMarketVolume ?? 0,
    marketCap: meta.marketCap,
    pe: meta.trailingPE,
    timestamp: Date.now(),
  };
}

export async function getHistorical(
  ticker: string,
  range: string = "1y"
): Promise<HistoricalBar[]> {
  const result = await fetchChart(ticker, "1d", range);

  const timestamps = result.timestamp ?? [];
  const quote = result.indicators?.quote?.[0];

  if (timestamps.length === 0 || !quote) {
    throw new Error(`No historical data available for ticker "${ticker}".`);
  }

  const bars: HistoricalBar[] = [];

  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i];
    const high = quote.high?.[i];
    const low = quote.low?.[i];
    const close = quote.close?.[i];
    const volume = quote.volume?.[i];

    if (
      open === null ||
      open === undefined ||
      high === null ||
      high === undefined ||
      low === null ||
      low === undefined ||
      close === null ||
      close === undefined
    ) {
      continue;
    }

    const date = new Date(timestamps[i] * 1000).toISOString().slice(0, 10);

    bars.push({
      date,
      open,
      high,
      low,
      close,
      volume: volume ?? 0,
    });
  }

  bars.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  return bars;
}

interface YahooRawValue {
  raw?: number;
}

interface YahooEarningsCalendar {
  earningsDate?: YahooRawValue[];
  earningsAverage?: YahooRawValue;
  earningsHigh?: YahooRawValue;
  earningsLow?: YahooRawValue;
  revenueAverage?: YahooRawValue;
  revenueHigh?: YahooRawValue;
  revenueLow?: YahooRawValue;
}

interface YahooFinancialData {
  recommendationKey?: string;
  recommendationMean?: YahooRawValue;
  numberOfAnalystOpinions?: YahooRawValue;
  targetMeanPrice?: YahooRawValue;
  targetHighPrice?: YahooRawValue;
  targetLowPrice?: YahooRawValue;
}

interface YahooRecommendationTrendEntry {
  period?: string;
  strongBuy?: number;
  buy?: number;
  hold?: number;
  sell?: number;
  strongSell?: number;
}

interface YahooQuoteSummaryResult {
  calendarEvents?: {
    earnings?: YahooEarningsCalendar;
  };
  financialData?: YahooFinancialData;
  summaryDetail?: {
    marketCap?: YahooRawValue;
  };
  recommendationTrend?: {
    trend?: YahooRecommendationTrendEntry[];
  };
}

interface YahooQuoteSummaryResponse {
  quoteSummary: {
    result: YahooQuoteSummaryResult[] | null;
    error: { code?: string; description?: string } | null;
  };
}

let cachedCrumb: { crumb: string; cookie: string; expiresAt: number } | null =
  null;

async function getYahooCrumb(): Promise<{
  crumb: string;
  cookie: string;
} | null> {
  if (cachedCrumb && Date.now() < cachedCrumb.expiresAt) {
    return { crumb: cachedCrumb.crumb, cookie: cachedCrumb.cookie };
  }

  try {
    const initRes = await fetch("https://fc.yahoo.com", {
      headers: { "User-Agent": USER_AGENT },
      redirect: "follow",
    });

    const setCookie = initRes.headers.get("set-cookie") ?? "";
    const cookie = setCookie
      .split(",")
      .map((c) => c.split(";")[0].trim())
      .filter(Boolean)
      .join("; ");

    const crumbRes = await fetch(
      "https://query2.finance.yahoo.com/v1/test/getcrumb",
      {
        headers: {
          "User-Agent": USER_AGENT,
          Cookie: cookie,
        },
      },
    );

    if (!crumbRes.ok) return null;

    const crumb = await crumbRes.text();
    if (!crumb) return null;

    cachedCrumb = { crumb, cookie, expiresAt: Date.now() + 3600_000 };
    return { crumb, cookie };
  } catch {
    return null;
  }
}

export async function getEarnings(ticker: string): Promise<EarningsData> {
  const empty: EarningsData = {
    ticker,
    earningsDate: null,
    epsEstimate: null,
    epsHigh: null,
    epsLow: null,
    revenueEstimate: null,
    revenueHigh: null,
    revenueLow: null,
    marketCap: null,
  };

  try {
    const auth = await getYahooCrumb();
    if (!auth) return empty;

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=calendarEvents,summaryDetail&crumb=${encodeURIComponent(auth.crumb)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: auth.cookie,
      },
    });

    if (!response.ok) return empty;

    const json = (await response.json()) as YahooQuoteSummaryResponse;

    if (json.quoteSummary.error) return empty;

    const result = json.quoteSummary.result?.[0];
    const earnings = result?.calendarEvents?.earnings;

    if (!earnings) return empty;

    const earningsTimestamp = earnings.earningsDate?.[0]?.raw;
    const earningsDate =
      earningsTimestamp !== undefined && earningsTimestamp !== null
        ? new Date(earningsTimestamp * 1000).toISOString().slice(0, 10)
        : null;

    const marketCapRaw = result?.summaryDetail?.marketCap?.raw ?? null;

    return {
      ticker,
      earningsDate,
      epsEstimate: earnings.earningsAverage?.raw ?? null,
      epsHigh: earnings.earningsHigh?.raw ?? null,
      epsLow: earnings.earningsLow?.raw ?? null,
      revenueEstimate: earnings.revenueAverage?.raw ?? null,
      revenueHigh: earnings.revenueHigh?.raw ?? null,
      revenueLow: earnings.revenueLow?.raw ?? null,
      marketCap: marketCapRaw,
    };
  } catch {
    return empty;
  }
}

interface YahooSearchNewsItem {
  title?: string;
  publisher?: string;
  link?: string;
  providerPublishTime?: number;
}

interface YahooSearchResponse {
  news?: YahooSearchNewsItem[];
}

export async function getNews(ticker: string): Promise<NewsArticle[]> {
  try {
    const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
      ticker,
    )}&newsCount=10&quotesCount=0&enableFuzzyQuery=false`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) return [];

    const json = (await response.json()) as YahooSearchResponse;
    const news = json.news ?? [];

    const articles: NewsArticle[] = news
      .filter((item) => item.title && item.link)
      .map((item) => ({
        title: item.title as string,
        publisher: item.publisher ?? "Unknown",
        link: item.link as string,
        publishedAt:
          item.providerPublishTime !== undefined
            ? new Date(item.providerPublishTime * 1000).toISOString()
            : new Date().toISOString(),
      }))
      .slice(0, 8);

    return articles;
  } catch {
    return [];
  }
}

export async function getAnalystData(ticker: string): Promise<AnalystData> {
  const empty: AnalystData = {
    ticker,
    recommendationKey: null,
    recommendationMean: null,
    numberOfAnalysts: null,
    targetMeanPrice: null,
    targetHighPrice: null,
    targetLowPrice: null,
  };

  try {
    const auth = await getYahooCrumb();
    if (!auth) return empty;

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=financialData&crumb=${encodeURIComponent(auth.crumb)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: auth.cookie,
      },
    });

    if (!response.ok) return empty;

    const json = (await response.json()) as YahooQuoteSummaryResponse;

    if (json.quoteSummary.error) return empty;

    const result = json.quoteSummary.result?.[0];
    const financialData = result?.financialData;

    if (!financialData) return empty;

    return {
      ticker,
      recommendationKey: financialData.recommendationKey ?? null,
      recommendationMean: financialData.recommendationMean?.raw ?? null,
      numberOfAnalysts: financialData.numberOfAnalystOpinions?.raw ?? null,
      targetMeanPrice: financialData.targetMeanPrice?.raw ?? null,
      targetHighPrice: financialData.targetHighPrice?.raw ?? null,
      targetLowPrice: financialData.targetLowPrice?.raw ?? null,
    };
  } catch {
    return empty;
  }
}

export async function getRecommendationTrend(ticker: string): Promise<RecommendationTrend> {
  const empty: RecommendationTrend = { ticker, trend: [] };

  try {
    const auth = await getYahooCrumb();
    if (!auth) return empty;

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker,
    )}?modules=recommendationTrend&crumb=${encodeURIComponent(auth.crumb)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: auth.cookie,
      },
    });

    if (!response.ok) return empty;

    const json = (await response.json()) as YahooQuoteSummaryResponse;
    if (json.quoteSummary.error) return empty;

    const result = json.quoteSummary.result?.[0];
    const entries = result?.recommendationTrend?.trend ?? [];

    const trend: RecommendationPeriod[] = entries.map((e) => ({
      period: e.period ?? "0m",
      strongBuy: e.strongBuy ?? 0,
      buy: e.buy ?? 0,
      hold: e.hold ?? 0,
      sell: e.sell ?? 0,
      strongSell: e.strongSell ?? 0,
    }));

    return { ticker, trend };
  } catch {
    return empty;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFundamentals(ticker: string, result: any): TickerFundamentals {
  const profile = result?.summaryProfile;
  const keyStats = result?.defaultKeyStatistics;
  const financial = result?.financialData;
  const summary = result?.summaryDetail;
  const ehRaw = result?.earningsHistory?.history ?? [];
  const incomeRaw = result?.incomeStatementHistory?.incomeStatementHistory ?? [];
  const cashRaw = result?.cashflowStatementHistory?.cashflowStatements ?? [];
  const etRaw = result?.earningsTrend?.trend ?? [];
  const calEarnings = result?.calendarEvents?.earnings;
  const earningsTimestamp = calEarnings?.earningsDate?.[0]?.raw;

  return {
    ticker,
    sector: profile?.sector ?? null,
    industry: profile?.industry ?? null,
    employees: profile?.fullTimeEmployees ?? null,
    description: profile?.longBusinessSummary ?? null,
    marketCap: summary?.marketCap?.raw ?? null,
    enterpriseValue: keyStats?.enterpriseValue?.raw ?? null,
    trailingPE: summary?.trailingPE?.raw ?? null,
    forwardPE: keyStats?.forwardPE?.raw ?? null,
    pegRatio: keyStats?.pegRatio?.raw ?? null,
    priceToBook: keyStats?.priceToBook?.raw ?? null,
    priceToSales: keyStats?.priceToSalesTrailing12Months?.raw ?? null,
    currentPrice: financial?.currentPrice?.raw ?? null,
    fiftyTwoWeekHigh: keyStats?.fiftyTwoWeekHigh?.raw ?? null,
    fiftyTwoWeekLow: keyStats?.fiftyTwoWeekLow?.raw ?? null,
    beta: keyStats?.beta?.raw ?? null,
    grossMargins: financial?.grossMargins?.raw ?? null,
    operatingMargins: financial?.operatingMargins?.raw ?? null,
    profitMargins: financial?.profitMargins?.raw ?? null,
    returnOnEquity: financial?.returnOnEquity?.raw ?? null,
    returnOnAssets: financial?.returnOnAssets?.raw ?? null,
    revenueGrowth: financial?.revenueGrowth?.raw ?? null,
    earningsGrowth: financial?.earningsGrowth?.raw ?? null,
    totalCash: financial?.totalCash?.raw ?? null,
    totalDebt: financial?.totalDebt?.raw ?? null,
    debtToEquity: financial?.debtToEquity?.raw ?? null,
    currentRatio: financial?.currentRatio?.raw ?? null,
    freeCashFlow: financial?.freeCashFlow?.raw ?? null,
    operatingCashFlow: financial?.operatingCashflow?.raw ?? null,
    shortPercentOfFloat: keyStats?.shortPercentOfFloat?.raw ?? null,
    sharesShort: keyStats?.sharesShort?.raw ?? null,
    recommendationKey: financial?.recommendationKey ?? null,
    targetMeanPrice: financial?.targetMeanPrice?.raw ?? null,
    targetHighPrice: financial?.targetHighPrice?.raw ?? null,
    targetLowPrice: financial?.targetLowPrice?.raw ?? null,
    numberOfAnalysts: financial?.numberOfAnalystOpinions?.raw ?? null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    earningsHistory: ehRaw.map((e: any) => ({
      quarter: e.quarter?.fmt ?? "",
      epsActual: e.epsActual?.raw ?? null,
      epsEstimate: e.epsEstimate?.raw ?? null,
      surprisePercent: e.surprisePercent?.raw ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quarterlyRevenue: incomeRaw.map((s: any) => ({
      quarter: s.endDate?.fmt ?? "",
      revenue: s.totalRevenue?.raw ?? null,
      netIncome: s.netIncome?.raw ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    quarterlyCashFlow: cashRaw.map((c: any) => ({
      quarter: c.endDate?.fmt ?? "",
      operatingCashFlow: c.totalCashFromOperatingActivities?.raw ?? null,
      capitalExpenditures: c.capitalExpenditures?.raw ?? null,
      freeCashFlow: c.freeCashFlow?.raw ?? null,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    earningsTrend: etRaw.map((e: any) => ({
      period: e.period ?? "",
      epsEstimate: e.earningsEstimate?.avg?.raw ?? null,
      epsGrowth: e.earningsEstimate?.growth?.raw ?? null,
      revenueEstimate: e.revenueEstimate?.avg?.raw ?? null,
      revenueGrowth: e.revenueEstimate?.growth?.raw ?? null,
    })),
    nextEarningsDate:
      earningsTimestamp != null
        ? new Date(earningsTimestamp * 1000).toISOString().slice(0, 10)
        : null,
  };
}

export async function getTickerFundamentals(ticker: string): Promise<TickerFundamentals> {
  const empty = extractFundamentals(ticker, {});

  try {
    const auth = await getYahooCrumb();
    if (!auth) return empty;

    const modules = [
      "defaultKeyStatistics",
      "financialData",
      "summaryDetail",
      "summaryProfile",
      "earningsHistory",
      "incomeStatementHistory",
      "cashflowStatementHistory",
      "earningsTrend",
      "calendarEvents",
    ].join(",");

    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      ticker
    )}?modules=${modules}&crumb=${encodeURIComponent(auth.crumb)}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Cookie: auth.cookie,
      },
    });

    if (!response.ok) return empty;

    const json = (await response.json()) as YahooQuoteSummaryResponse;
    if (json.quoteSummary.error) return empty;

    const result = json.quoteSummary.result?.[0];
    if (!result) return empty;

    return extractFundamentals(ticker, result);
  } catch {
    return empty;
  }
}
