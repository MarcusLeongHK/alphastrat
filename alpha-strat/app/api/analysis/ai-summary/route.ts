import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { generateCompletion } from "@/lib/ai/client";
import {
  PORTFOLIO_SUMMARY_SYSTEM,
  buildPortfolioSummaryPrompt,
} from "@/lib/ai/prompts";

const AI_SUMMARY_TTL = 6 * 3600;

interface PositionInput {
  ticker: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  weight: number;
  pnlPercent: number;
}

interface MetricsInput {
  beta: number;
  sharpe: number;
  cagr: number;
}

interface AiSummaryRequestBody {
  positions: PositionInput[];
  metrics: MetricsInput;
}

function buildCacheKey(userId: string, body: AiSummaryRequestBody): string {
  const fingerprint = body.positions
    .map((p) => `${p.ticker}:${p.quantity}:${p.costBasis}`)
    .sort()
    .join("|");
  return `ai-summary:${userId}:${fingerprint}`;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as AiSummaryRequestBody;

    if (!body.positions || !body.metrics) {
      return NextResponse.json(
        { error: "Request body must include positions and metrics" },
        { status: 400 },
      );
    }

    const cacheKey = buildCacheKey(claimsData.claims.sub as string, body);

    const { data: summary } = await getOrFetch<string>(
      supabase,
      cacheKey,
      "ai-summary",
      AI_SUMMARY_TTL,
      async () => {
        const userPrompt = buildPortfolioSummaryPrompt(
          body.positions,
          body.metrics,
        );
        return generateCompletion(PORTFOLIO_SUMMARY_SYSTEM, userPrompt);
      },
    );

    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to generate AI summary: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 },
    );
  }
}
