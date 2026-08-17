import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getAdanosCompareSentiment, getAvailableSources, type AdanosCompareResult } from "@/lib/market/adanos";
import { ADANOS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers")?.trim().toUpperCase();

  if (!tickersParam) {
    return NextResponse.json({ error: "Missing required query param: tickers" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").filter(Boolean).slice(0, 10);

  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sortedKey = [...tickers].sort().join(",");
    const availableSources = getAvailableSources();

    const { data } = await getOrFetch(
      supabase,
      `batch-sentiment:${sortedKey}`,
      "batch-sentiment",
      ADANOS_TTL,
      async () => {
        const results: Record<string, Record<string, AdanosCompareResult>> = {};

        const sourceResults = await Promise.all(
          availableSources.map(async (source) => {
            const map = await getAdanosCompareSentiment(
              tickers,
              source as "reddit" | "twitter" | "news" | "polymarket"
            );
            return { source, data: Object.fromEntries(map) };
          })
        );

        for (const { source, data } of sourceResults) {
          results[source] = data;
        }

        return { tickers, sources: results };
      },
      {
        shouldCache: (result) =>
          Object.values(result.sources).some((s) => Object.keys(s).length > 0),
        shared: true,
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch batch sentiment: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
