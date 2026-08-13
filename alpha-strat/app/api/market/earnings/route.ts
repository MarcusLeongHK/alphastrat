import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getEarnings } from "@/lib/market/yahoo";
import { EARNINGS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { EarningsData } from "@/lib/market/types";

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
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const earnings: EarningsData[] = await Promise.all(
      tickers.map(async (ticker) => {
        const { data } = await getOrFetch<EarningsData>(
          supabase,
          `earnings:${ticker}`,
          "earnings",
          EARNINGS_TTL,
          () => getEarnings(ticker)
        );
        return data;
      })
    );

    return NextResponse.json(earnings);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch earnings: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
