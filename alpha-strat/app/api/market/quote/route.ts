import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getQuote } from "@/lib/market/yahoo";
import { PRICE_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { QuoteData } from "@/lib/market/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers");

  if (!tickersParam) {
    return NextResponse.json(
      { error: "Missing required query param: tickers" },
      { status: 400 }
    );
  }

  const tickers = tickersParam
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);

  if (tickers.length === 0) {
    return NextResponse.json(
      { error: "Missing required query param: tickers" },
      { status: 400 }
    );
  }

  try {
    const supabase = await createClient();

    const quotes: QuoteData[] = await Promise.all(
      tickers.map(async (ticker) => {
        const { data } = await getOrFetch<QuoteData>(
          supabase,
          `price:${ticker}`,
          "price",
          PRICE_TTL,
          () => getQuote(ticker)
        );
        return data;
      })
    );

    return NextResponse.json(quotes);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch quotes: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
