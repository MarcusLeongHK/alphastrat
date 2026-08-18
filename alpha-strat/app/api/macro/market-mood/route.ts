import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import {
  getAdanosTrending,
  getAdanosMarketSentiment,
  getAdanosSectorTrending,
  type AdanosTrendingTicker,
  type AdanosMarketSentiment,
  type AdanosSectorSentiment,
} from "@/lib/market/adanos";
import { ADANOS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";

interface MarketMoodResponse {
  trending: AdanosTrendingTicker[];
  marketSentiment: AdanosMarketSentiment | null;
  sectors: AdanosSectorSentiment[];
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await getOrFetch<MarketMoodResponse>(
      supabase,
      "macro:market-mood",
      "market-mood",
      ADANOS_TTL,
      async () => {
        const [trending, marketSentiment, sectors] = await Promise.all([
          getAdanosTrending(),
          getAdanosMarketSentiment(),
          getAdanosSectorTrending(),
        ]);
        return { trending, marketSentiment, sectors };
      },
      {
        shouldCache: (result) =>
          !!(result.trending.length > 0 || result.marketSentiment || result.sectors.length > 0),
        shared: true,
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch market mood: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
