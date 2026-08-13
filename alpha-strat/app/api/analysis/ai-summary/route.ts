import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { generateCompletion } from "@/lib/ai/client";
import {
  PORTFOLIO_SUMMARY_SYSTEM,
  buildPortfolioSummaryPrompt,
} from "@/lib/ai/prompts";

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
        { status: 400 }
      );
    }

    const userPrompt = buildPortfolioSummaryPrompt(
      body.positions,
      body.metrics
    );

    const summary = await generateCompletion(
      PORTFOLIO_SUMMARY_SYSTEM,
      userPrompt
    );

    return NextResponse.json({ summary });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to generate AI summary: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
