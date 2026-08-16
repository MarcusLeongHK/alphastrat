import type { OptionsContract, OptionsChain, OptionsSnapshot } from "./types-options";
import { getOrFetch } from "@/lib/cache";
import { RFR_TTL } from "@/lib/cache/freshness";
import { getQuote } from "./yahoo";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface YahooOptionContract {
  strike?: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
}

interface YahooOptionsResult {
  underlyingSymbol?: string;
  expirationDates?: number[];
  strikes?: number[];
  quote?: { regularMarketPrice?: number };
  options?: Array<{
    expirationDate?: number;
    calls?: YahooOptionContract[];
    puts?: YahooOptionContract[];
  }>;
}

interface YahooOptionsResponse {
  optionChain: {
    result: YahooOptionsResult[] | null;
    error: { code?: string; description?: string } | null;
  };
}

/** Raw result shape returned by the Yahoo v7 options endpoint for a single expiry. */
export type RawOptionsResponse = YahooOptionsResult;

function mapContract(
  raw: YahooOptionContract,
  type: "call" | "put",
  expiryIso: string
): OptionsContract {
  return {
    strike: raw.strike ?? 0,
    bid: raw.bid ?? null,
    ask: raw.ask ?? null,
    lastPrice: raw.lastPrice ?? null,
    volume: raw.volume ?? 0,
    openInterest: raw.openInterest ?? 0,
    impliedVolatility: raw.impliedVolatility ?? null,
    inTheMoney: raw.inTheMoney ?? false,
    contractType: type,
    expiry: expiryIso,
  };
}

function unixToIso(unix: number): string {
  return new Date(unix * 1000).toISOString().split("T")[0];
}

function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

/**
 * Fetch a single options chain page (one expiry) from the Yahoo Finance v7
 * options endpoint. The v7 endpoint does not require crumb/cookie auth.
 */
export async function getOptionsChain(
  ticker: string,
  expiry?: number
): Promise<RawOptionsResponse> {
  let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
  if (expiry != null) {
    url += `?date=${expiry}`;
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
  } catch (err) {
    throw new Error(
      `Failed to reach Yahoo Finance options endpoint for "${ticker}": ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance options request failed for "${ticker}" with status ${response.status}`
    );
  }

  const json = (await response.json()) as YahooOptionsResponse;

  if (json.optionChain.error) {
    throw new Error(
      `Yahoo Finance options error for "${ticker}": ${
        json.optionChain.error.description ?? json.optionChain.error.code ?? "unknown"
      }`
    );
  }

  const result = json.optionChain.result?.[0];
  if (!result) {
    throw new Error(`No options data returned for "${ticker}"`);
  }

  return result;
}

function parseChain(result: RawOptionsResponse): OptionsChain | null {
  const optData = result.options?.[0];
  if (!optData || optData.expirationDate == null) return null;

  const expiryIso = unixToIso(optData.expirationDate);

  return {
    expiryDate: expiryIso,
    daysToExpiry: daysUntil(expiryIso),
    calls: (optData.calls ?? []).map((c) => mapContract(c, "call", expiryIso)),
    puts: (optData.puts ?? []).map((p) => mapContract(p, "put", expiryIso)),
  };
}

/**
 * Fetch the nearest expiry chain plus the next 3 closest expiries, returning
 * a combined snapshot of the underlying and its near-term options chains.
 */
export async function getAllNearTermChains(ticker: string): Promise<OptionsSnapshot> {
  // First fetch: get nearest expiry chain + all available expiry timestamps
  const firstResult = await getOptionsChain(ticker);

  const underlyingPrice = firstResult.quote?.regularMarketPrice ?? 0;
  const allExpiries = firstResult.expirationDates ?? [];

  const chains: OptionsChain[] = [];

  // Parse the first (nearest) chain
  const firstChain = parseChain(firstResult);
  if (firstChain) chains.push(firstChain);

  // Fetch next 3 closest expiries in parallel
  const usedExpiry = firstResult.options?.[0]?.expirationDate;
  const remainingExpiries = allExpiries.filter((e) => e !== usedExpiry).slice(0, 3);

  const additionalResults = await Promise.all(
    remainingExpiries.map((exp) => getOptionsChain(ticker, exp).catch(() => null))
  );

  for (const res of additionalResults) {
    if (!res) continue;
    const chain = parseChain(res);
    if (chain) chains.push(chain);
  }

  return {
    ticker,
    underlyingPrice,
    chains,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch the current 13-week Treasury bill yield (^IRX) as a decimal risk-free
 * rate, cached shared across users since it barely moves day-to-day.
 */
export async function getRiskFreeRate(supabase: SupabaseClient): Promise<number> {
  const { data } = await getOrFetch<number>(
    supabase,
    "rfr-irx",
    "risk-free-rate",
    RFR_TTL,
    async () => {
      const quote = await getQuote("^IRX");
      // ^IRX returns yield as percentage (e.g. 5.25), convert to decimal
      return quote.price / 100;
    },
    { shared: true }
  );

  return data;
}
