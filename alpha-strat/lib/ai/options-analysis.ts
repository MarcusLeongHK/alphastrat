import { generateCompletion } from "./client";
import type { OptionsSignals } from "@/lib/market/types-options";

const OPTIONS_SYSTEM_PROMPT = `You are a senior equity analyst at a top-tier investment bank. You use the options market as a sentiment indicator to understand what institutional investors and market makers are pricing in about a stock's future. You are NOT providing options trading advice — you are reading the options market to inform an equity view.

Rules:
- Write with conviction. No hedging language ("could potentially", "might be").
- Cite specific numbers: expected move %, IV levels, put/call ratios, volume/OI ratios.
- Connect options signals to fundamental catalysts (earnings, macro, sector rotation).
- When unusual activity exists, interpret what the bet implies about expectations.
- Compare implied volatility to historical volatility — state whether options are pricing more or less risk than realized.
- If term structure shows a spike at a specific expiry, identify what event is being priced there.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "marketPositioning": "2-4 sentences on overall sentiment from aggregate flow, skew, and put/call ratio",
  "expectedMoveAnalysis": "2-4 sentences on the priced-in move vs historical context",
  "volatilityAssessment": "2-4 sentences on IV vs historical vol, term structure shape, IV crush risk",
  "notableFlow": "2-4 sentences interpreting unusual activity and what those bets suggest",
  "keyRisksAndCatalysts": "2-4 sentences on what the options market is hedging or speculating on",
  "actionableTakeaway": "1-2 sentences — concise bottom line for an equity investor"
}`;

interface QuoteContext {
  price: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface FundamentalsContext {
  nextEarningsDate: string | null;
  consensusEps: number | null;
}

export interface OptionsAnalysisText {
  marketPositioning: string;
  expectedMoveAnalysis: string;
  volatilityAssessment: string;
  notableFlow: string;
  keyRisksAndCatalysts: string;
  actionableTakeaway: string;
}

function formatSignalsForPrompt(
  ticker: string,
  signals: OptionsSignals,
  quote: QuoteContext,
  fundamentals: FundamentalsContext | null
): string {
  const lines: string[] = [
    `## Options Analysis Data for ${ticker}`,
    ``,
    `**Current Price:** $${quote.price.toFixed(2)}`,
  ];

  if (quote.fiftyTwoWeekHigh != null && quote.fiftyTwoWeekLow != null) {
    lines.push(
      `**52-Week Range:** $${quote.fiftyTwoWeekLow.toFixed(2)} — $${quote.fiftyTwoWeekHigh.toFixed(2)}`
    );
  }

  if (fundamentals?.nextEarningsDate) {
    lines.push(`**Next Earnings Date:** ${fundamentals.nextEarningsDate}`);
  }
  if (fundamentals?.consensusEps != null) {
    lines.push(`**Consensus EPS:** $${fundamentals.consensusEps.toFixed(2)}`);
  }

  lines.push(``);
  lines.push(`### Pre-Computed Options Signals`);
  lines.push(``);
  lines.push(
    `**Expected Move (nearest expiry):** $${signals.expectedMove.dollars.toFixed(2)} (${signals.expectedMove.percent.toFixed(1)}%)`
  );
  lines.push(
    `**Expected Range:** $${signals.expectedMove.lowerBound.toFixed(2)} — $${signals.expectedMove.upperBound.toFixed(2)}`
  );
  lines.push(`**Put/Call Ratio:** ${isFinite(signals.putCallRatio) ? signals.putCallRatio.toFixed(2) : "N/A (no call volume)"}`);
  lines.push(
    `**IV Skew:** ${signals.ivSkew.direction} (magnitude: ${(signals.ivSkew.magnitude * 100).toFixed(1)}%)`
  );
  lines.push(`**ATM Implied Volatility:** ${(signals.atmIv * 100).toFixed(1)}%`);
  lines.push(
    `**Historical Volatility (30d):** ${(signals.historicalVolatility * 100).toFixed(1)}%`
  );
  lines.push(
    `**IV vs HV:** ${signals.atmIv > signals.historicalVolatility ? "IV is ELEVATED above realized vol" : "IV is BELOW realized vol"} (spread: ${(Math.abs(signals.atmIv - signals.historicalVolatility) * 100).toFixed(1)}%)`
  );
  lines.push(`**Max Pain:** $${signals.maxPain.toFixed(2)}`);

  lines.push(``);
  lines.push(`### IV Term Structure (ATM IV by Expiry)`);
  for (const ts of signals.termStructure) {
    lines.push(`- ${ts.expiry} (${ts.daysToExpiry}d): ${(ts.atmIv * 100).toFixed(1)}%`);
  }

  lines.push(``);
  lines.push(`### Greeks at ATM Strike`);
  lines.push(`- Delta: ${signals.greeksSummary.atmDelta.toFixed(4)}`);
  lines.push(`- Gamma: ${signals.greeksSummary.atmGamma.toFixed(4)}`);
  lines.push(`- Theta: $${signals.greeksSummary.atmTheta.toFixed(4)}/day`);
  lines.push(`- Vega: $${signals.greeksSummary.atmVega.toFixed(4)}/1% IV`);

  if (signals.unusualActivity.length > 0) {
    lines.push(``);
    lines.push(`### Unusual Activity (Volume > 2x Open Interest)`);
    for (const ua of signals.unusualActivity) {
      lines.push(
        `- ${ua.type.toUpperCase()} $${ua.strike} exp ${ua.expiry}: vol=${ua.volume}, OI=${ua.openInterest}, ratio=${ua.volumeOiRatio.toFixed(1)}x`
      );
    }
  } else {
    lines.push(``);
    lines.push(`### Unusual Activity: None detected`);
  }

  return lines.join("\n");
}

export async function generateOptionsAnalysis(
  ticker: string,
  signals: OptionsSignals,
  quote: QuoteContext,
  fundamentals: FundamentalsContext | null
): Promise<OptionsAnalysisText> {
  const userPrompt = formatSignalsForPrompt(ticker, signals, quote, fundamentals);

  try {
    const raw = await generateCompletion(
      OPTIONS_SYSTEM_PROMPT,
      userPrompt,
      "gemini"
    );

    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    const parsed = JSON.parse(cleaned) as OptionsAnalysisText;

    return {
      marketPositioning: parsed.marketPositioning ?? "",
      expectedMoveAnalysis: parsed.expectedMoveAnalysis ?? "",
      volatilityAssessment: parsed.volatilityAssessment ?? "",
      notableFlow: parsed.notableFlow ?? "",
      keyRisksAndCatalysts: parsed.keyRisksAndCatalysts ?? "",
      actionableTakeaway: parsed.actionableTakeaway ?? "",
    };
  } catch {
    const fallback = "Unable to generate options analysis. Please try refreshing.";
    return {
      marketPositioning: fallback,
      expectedMoveAnalysis: fallback,
      volatilityAssessment: fallback,
      notableFlow: fallback,
      keyRisksAndCatalysts: fallback,
      actionableTakeaway: fallback,
    };
  }
}
