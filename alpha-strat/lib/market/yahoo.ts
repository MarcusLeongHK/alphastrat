import { QuoteData, HistoricalBar } from "./types";

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
