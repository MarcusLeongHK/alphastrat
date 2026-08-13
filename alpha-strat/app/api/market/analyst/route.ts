import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getAnalystData } from "@/lib/market/yahoo";
import { ANALYST_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";
import { AnalystData } from "@/lib/market/types";

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

    const analysts: AnalystData[] = await Promise.all(
      tickers.map(async (ticker) => {
        const { data } = await getOrFetch<AnalystData>(
          supabase,
          `analyst:${ticker}`,
          "analyst",
          ANALYST_TTL,
          () => getAnalystData(ticker)
        );
        return data;
      })
    );

    return NextResponse.json(analysts);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch analyst data: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
