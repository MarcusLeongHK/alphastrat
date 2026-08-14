import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { THESIS_TTL } from "@/lib/cache/freshness";
import { getTickerFundamentals, getNews } from "@/lib/market/yahoo";
import { generateThesis } from "@/lib/ai/thesis";
import type { ThesisResponse } from "@/lib/market/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticker = request.nextUrl.searchParams.get("ticker");
    if (!ticker) {
      return NextResponse.json(
        { error: "ticker parameter is required" },
        { status: 400 }
      );
    }

    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    if (refresh) {
      await supabase
        .from("cache")
        .delete()
        .eq("cache_key", `thesis-${ticker.toUpperCase()}`)
        .is("user_id", null);
    }

    const { data } = await getOrFetch<ThesisResponse>(
      supabase,
      `thesis-${ticker.toUpperCase()}`,
      "thesis",
      THESIS_TTL,
      async () => {
        const [fundamentals, newsArticles] = await Promise.all([
          getTickerFundamentals(ticker.toUpperCase()),
          getNews(ticker.toUpperCase()),
        ]);

        const headlines = newsArticles.map((a) => a.title);
        return generateThesis(fundamentals, headlines);
      },
      {
        shouldCache: (result) =>
          result.bullCase.length > 0 &&
          !result.bullCase.startsWith("Unable to generate") &&
          result.bearCase.length > 0 &&
          !result.bearCase.startsWith("Unable to generate"),
        shared: true,
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to generate thesis: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
