import { generateCompletion } from "./client";
import type { TickerFundamentals, ThesisResponse } from "@/lib/market/types";

const THESIS_SYSTEM_PROMPT = `You interpret company fundamentals data and produce an investment thesis. Your job is to describe what the numbers show — not to sound like a Wall Street analyst. Accuracy matters more than confidence.

Rules:
- Lead with the data, then interpret. Every claim must cite a specific number from the input.
- Use explicit thresholds for context:
  - P/E < 15: cheap relative to S&P median ~22x
  - P/E 15-25: fairly valued
  - P/E > 30: premium valuation, requires above-average growth to justify
  - Revenue growth > 15%: above-average
  - Revenue growth 5-15%: moderate
  - Revenue growth < 5%: slow
  - Debt/equity > 1.5: leveraged
  - Net margin > 20%: high profitability
  - FCF yield > 5%: strong cash generation
- Do not claim "competitive moat" or "market dominance" unless operating margins have been stable or growing over 3+ years AND margins are above the sector median.
- Do not predict specific price targets or percentage returns. State what the valuation implies, not what the stock "will" do.
- If a metric is N/A or missing, say so — do not fill gaps with assumptions.
- Each case (bull, bear, base) must be 4-6 sentences. Every sentence must reference a specific number or ratio.
- The investment rating must be derived from the balance of bull vs bear evidence. If evidence is roughly even, "Hold" is the correct rating, not a guess.
- If the data is insufficient for a confident assessment (multiple key metrics missing), set rating to "Insufficient Data".
- For keyMetrics, select the 6-8 most relevant metrics for THIS company. Context must compare to a benchmark ("vs sector median 22x", "vs 15% last year").
- If a bull or bear case rests on forward-looking assumptions (market expansion, new product), flag it as speculative rather than stating it as fact.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "rating": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "Insufficient Data",
  "ratingRationale": "1-2 sentences citing the key numbers that drive this rating",
  "bullCase": "4-6 sentences, each citing specific data",
  "bearCase": "4-6 sentences, each citing specific data",
  "baseCase": "4-6 sentences, each citing specific data",
  "bullSummary": "One sentence capturing the core bull thesis",
  "bearSummary": "One sentence capturing the core bear thesis",
  "baseSummary": "One sentence capturing the core base case",
  "keyMetrics": [
    { "label": "metric name", "value": "formatted value", "context": "comparison to benchmark" }
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

function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 100);
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

    const validRatings = ["Strong Buy", "Buy", "Hold", "Sell", "Strong Sell", "Insufficient Data"];
    const rating = validRatings.includes(parsed.rating) ? parsed.rating : "Hold";

    return {
      ticker: fundamentals.ticker,
      rating: rating as ThesisResponse["rating"],
      ratingRationale: parsed.ratingRationale || "Unable to determine rating rationale.",
      bullCase: parsed.bullCase || "Insufficient data for bull case analysis.",
      bearCase: parsed.bearCase || "Insufficient data for bear case analysis.",
      baseCase: parsed.baseCase || "Insufficient data for base case analysis.",
      bullSummary: parsed.bullSummary || extractFirstSentence(parsed.bullCase || ""),
      bearSummary: parsed.bearSummary || extractFirstSentence(parsed.bearCase || ""),
      baseSummary: parsed.baseSummary || extractFirstSentence(parsed.baseCase || ""),
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
      bullSummary: "Unable to generate summary.",
      bearSummary: "Unable to generate summary.",
      baseSummary: "Unable to generate summary.",
      keyMetrics: [],
      generatedAt: new Date().toISOString(),
    };
  }
}
