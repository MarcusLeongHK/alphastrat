import { generateCompletion } from "./client";
import type { TickerFundamentals, ThesisResponse } from "@/lib/market/types";

const THESIS_SYSTEM_PROMPT = `You are a senior equity research analyst writing an investment thesis for institutional investors. Your analysis is fundamentals-driven with a 3-5 year investment horizon.

Rules:
- Write with conviction. No hedging ("could potentially", "might be", "it remains to be seen"). State your view directly.
- Cite specific numbers from the data: revenue growth rates, margin percentages, debt ratios, FCF yield, P/E multiples.
- Each case (bull, bear, base) must be up to 8 sentences. Be thorough and specific.
- The investment rating must flow logically from your analysis — derive it from the bull/bear/base cases, don't pick it first.
- For keyMetrics, select the 6-8 most relevant metrics for THIS specific company and add context (e.g., "vs sector median 22x", "supports 3% dividend yield", "improved from 15% last year").
- Focus on: revenue durability, margin trajectory, competitive moats, capital allocation discipline, balance sheet health, and valuation relative to intrinsic value.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "rating": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell",
  "ratingRationale": "1-2 sentence summary of why this rating",
  "bullCase": "up to 8 sentences",
  "bearCase": "up to 8 sentences",
  "baseCase": "up to 8 sentences",
  "keyMetrics": [
    { "label": "metric name", "value": "formatted value", "context": "comparison or insight" }
  ]
}`;

function formatNumber(n: number | null, prefix = ""): string {
  if (n === null) return "N/A";
  if (Math.abs(n) >= 1e12) return `${prefix}${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B`;
  if (Math.abs(n) >= 1e6) return `${prefix}${(n / 1e6).toFixed(1)}M`;
  return `${prefix}${n.toLocaleString()}`;
}

function formatPercent(n: number | null): string {
  if (n === null) return "N/A";
  return `${(n * 100).toFixed(1)}%`;
}

function formatRatio(n: number | null): string {
  if (n === null) return "N/A";
  return n.toFixed(2);
}

export function buildThesisPrompt(
  fundamentals: TickerFundamentals,
  newsHeadlines: string[]
): string {
  const sections: string[] = [];

  sections.push(`=== COMPANY PROFILE ===
Ticker: ${fundamentals.ticker}
Sector: ${fundamentals.sector ?? "N/A"}
Industry: ${fundamentals.industry ?? "N/A"}
Employees: ${fundamentals.employees?.toLocaleString() ?? "N/A"}
Description: ${fundamentals.description ?? "N/A"}`);

  sections.push(`=== VALUATION ===
Market Cap: ${formatNumber(fundamentals.marketCap, "$")}
Enterprise Value: ${formatNumber(fundamentals.enterpriseValue, "$")}
Trailing P/E: ${formatRatio(fundamentals.trailingPE)}
Forward P/E: ${formatRatio(fundamentals.forwardPE)}
PEG Ratio: ${formatRatio(fundamentals.pegRatio)}
Price/Book: ${formatRatio(fundamentals.priceToBook)}
Price/Sales: ${formatRatio(fundamentals.priceToSales)}
Current Price: $${fundamentals.currentPrice?.toFixed(2) ?? "N/A"}
52-Week High: $${fundamentals.fiftyTwoWeekHigh?.toFixed(2) ?? "N/A"}
52-Week Low: $${fundamentals.fiftyTwoWeekLow?.toFixed(2) ?? "N/A"}
Beta: ${formatRatio(fundamentals.beta)}`);

  sections.push(`=== PROFITABILITY ===
Gross Margin: ${formatPercent(fundamentals.grossMargins)}
Operating Margin: ${formatPercent(fundamentals.operatingMargins)}
Net Margin: ${formatPercent(fundamentals.profitMargins)}
ROE: ${formatPercent(fundamentals.returnOnEquity)}
ROA: ${formatPercent(fundamentals.returnOnAssets)}`);

  sections.push(`=== GROWTH ===
Revenue Growth (YoY): ${formatPercent(fundamentals.revenueGrowth)}
Earnings Growth (YoY): ${formatPercent(fundamentals.earningsGrowth)}`);

  sections.push(`=== FINANCIAL HEALTH ===
Total Cash: ${formatNumber(fundamentals.totalCash, "$")}
Total Debt: ${formatNumber(fundamentals.totalDebt, "$")}
Debt/Equity: ${formatRatio(fundamentals.debtToEquity)}
Current Ratio: ${formatRatio(fundamentals.currentRatio)}
Free Cash Flow: ${formatNumber(fundamentals.freeCashFlow, "$")}
Operating Cash Flow: ${formatNumber(fundamentals.operatingCashFlow, "$")}`);

  sections.push(`=== SHORT INTEREST ===
Short % of Float: ${formatPercent(fundamentals.shortPercentOfFloat)}
Shares Short: ${fundamentals.sharesShort?.toLocaleString() ?? "N/A"}`);

  sections.push(`=== ANALYST CONSENSUS ===
Recommendation: ${fundamentals.recommendationKey ?? "N/A"}
Mean Target: $${fundamentals.targetMeanPrice?.toFixed(2) ?? "N/A"}
High Target: $${fundamentals.targetHighPrice?.toFixed(2) ?? "N/A"}
Low Target: $${fundamentals.targetLowPrice?.toFixed(2) ?? "N/A"}
Number of Analysts: ${fundamentals.numberOfAnalysts ?? "N/A"}`);

  if (fundamentals.earningsHistory.length > 0) {
    const ehLines = fundamentals.earningsHistory.map(
      (e) =>
        `  ${e.quarter}: Actual EPS $${e.epsActual?.toFixed(2) ?? "N/A"} vs Est $${e.epsEstimate?.toFixed(2) ?? "N/A"} (${e.surprisePercent !== null ? `${(e.surprisePercent * 100).toFixed(1)}% surprise` : "N/A"})`
    );
    sections.push(`=== EARNINGS HISTORY (Last ${fundamentals.earningsHistory.length} Quarters) ===\n${ehLines.join("\n")}`);
  }

  if (fundamentals.quarterlyRevenue.length > 0) {
    const revLines = fundamentals.quarterlyRevenue.map(
      (r) =>
        `  ${r.quarter}: Revenue ${formatNumber(r.revenue, "$")}, Net Income ${formatNumber(r.netIncome, "$")}`
    );
    sections.push(`=== QUARTERLY INCOME ===\n${revLines.join("\n")}`);
  }

  if (fundamentals.quarterlyCashFlow.length > 0) {
    const cfLines = fundamentals.quarterlyCashFlow.map(
      (c) =>
        `  ${c.quarter}: OpCF ${formatNumber(c.operatingCashFlow, "$")}, CapEx ${formatNumber(c.capitalExpenditures, "$")}, FCF ${formatNumber(c.freeCashFlow, "$")}`
    );
    sections.push(`=== QUARTERLY CASH FLOW ===\n${cfLines.join("\n")}`);
  }

  if (newsHeadlines.length > 0) {
    sections.push(`=== RECENT NEWS ===\n${newsHeadlines.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}`);
  }

  return `Generate an investment thesis for ${fundamentals.ticker}.\n\n${sections.join("\n\n")}`;
}

export async function generateThesis(
  fundamentals: TickerFundamentals,
  newsHeadlines: string[]
): Promise<ThesisResponse> {
  const userPrompt = buildThesisPrompt(fundamentals, newsHeadlines);

  const raw = await generateCompletion(THESIS_SYSTEM_PROMPT, userPrompt, "gemini");

  const cleaned = raw
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as Omit<ThesisResponse, "ticker" | "generatedAt">;

    const validRatings = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell"];
    const rating = validRatings.includes(parsed.rating) ? parsed.rating : "Hold";

    return {
      ticker: fundamentals.ticker,
      rating: rating as ThesisResponse["rating"],
      ratingRationale: parsed.ratingRationale || "Unable to determine rating rationale.",
      bullCase: parsed.bullCase || "Insufficient data for bull case analysis.",
      bearCase: parsed.bearCase || "Insufficient data for bear case analysis.",
      baseCase: parsed.baseCase || "Insufficient data for base case analysis.",
      keyMetrics: Array.isArray(parsed.keyMetrics) ? parsed.keyMetrics : [],
      generatedAt: new Date().toISOString(),
    };
  } catch {
    return {
      ticker: fundamentals.ticker,
      rating: "Hold",
      ratingRationale: "Thesis generation encountered a parsing error.",
      bullCase: "Unable to generate bull case. Please try refreshing.",
      bearCase: "Unable to generate bear case. Please try refreshing.",
      baseCase: "Unable to generate base case. Please try refreshing.",
      keyMetrics: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
