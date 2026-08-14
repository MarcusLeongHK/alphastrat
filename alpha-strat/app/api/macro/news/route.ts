import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { MACRO_TTL } from "@/lib/cache/freshness";
import { fetchMacroFeeds, type MacroCategory } from "@/lib/market/rss";
import { generateMacroSummary } from "@/lib/ai/macro-summary";

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string;
  generatedAt: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await getOrFetch<MacroNewsResponse>(
      supabase,
      "macro-news",
      "macro",
      MACRO_TTL,
      async () => {
        const categories = await fetchMacroFeeds();
        const summaryResult = await generateMacroSummary(categories);

        const enrichedCategories = categories.map((cat) => {
          const match = summaryResult.categories.find((s) => s.id === cat.id);
          return { ...cat, summary: match?.summary ?? "" };
        });

        return {
          categories: enrichedCategories,
          macroOutlook: summaryResult.macroOutlook,
          generatedAt: new Date().toISOString(),
        };
      },
      {
        shouldCache: (result) =>
          result.categories.some((c) => c.articles.length > 0),
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch macro news: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
