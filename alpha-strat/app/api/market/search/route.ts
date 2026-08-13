import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type YahooQuote = {
  symbol?: string;
  shortname?: string;
  longname?: string;
  quoteType?: string;
  exchange?: string;
};

type YahooSearchResponse = {
  quotes?: YahooQuote[];
};

type SearchResult = {
  symbol: string;
  name: string;
};

const YAHOO_SEARCH_URL = "https://query1.finance.yahoo.com/v1/finance/search";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: claimsData, error: authError } =
    await supabase.auth.getClaims();

  if (authError || !claimsData?.claims?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const q = request.nextUrl.searchParams.get("q");

  if (!q || q.trim().length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const url = new URL(YAHOO_SEARCH_URL);
    url.searchParams.set("q", q.trim());
    url.searchParams.set("quotesCount", "6");
    url.searchParams.set("newsCount", "0");
    url.searchParams.set("listsCount", "0");

    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = (await res.json()) as YahooSearchResponse;

    const results: SearchResult[] = (data.quotes ?? [])
      .filter(
        (quote) =>
          quote.symbol &&
          (quote.quoteType === "EQUITY" || quote.quoteType === "ETF")
      )
      .map((quote) => ({
        symbol: quote.symbol as string,
        name: quote.shortname ?? quote.longname ?? (quote.symbol as string),
      }))
      .slice(0, 6);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
