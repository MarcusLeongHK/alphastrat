import { generateCompletion } from "./client";
import type { OptionsSignals } from "@/lib/market/types-options";

const OPTIONS_SYSTEM_PROMPT = `You interpret options market data. Your job is to describe what the numbers show — not to sound like a Wall Street analyst. Accuracy matters more than confidence.

Rules:
- ONLY state what the provided data directly supports. Do not invent catalysts, narratives, or institutional motivations that aren't in the data.
- Cite specific numbers from the data: expected move %, IV levels, put/call ratios, volume/OI ratios.
- Clearly distinguish between FACT (what the numbers show) and INTERPRETATION (what they might mean). Lead with fact.
- When data is unremarkable, say so. A put/call ratio of 0.8 is normal — don't dramatize it.
- Compare IV to historical volatility using the exact spread provided. State whether the gap is small (<5pp), moderate (5-15pp), or large (>15pp).
- If no unusual activity exists, say "No unusual options activity detected" — don't manufacture significance from normal flow.
- If term structure is roughly flat, say it's flat. Only flag a spike if one expiry's IV is >20% above neighbors.
- Never use phrases like "institutional gamma-hedging", "smart money positioning", or "whale activity" unless the data directly evidences it (e.g., single strikes with 10x+ volume/OI).
- When the next earnings date is provided and near, note that IV elevation near that date is expected and routine — not a signal.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "marketPositioning": "2-3 sentences. State the put/call ratio and skew direction with numbers. Say whether this leans bullish, bearish, or is neutral. If neutral, say neutral.",
  "expectedMoveAnalysis": "2-3 sentences. State the expected move in $ and %. Compare to recent realized moves if historical vol is available. Note if the move seems wide or narrow relative to historical.",
  "volatilityAssessment": "2-3 sentences. State ATM IV and historical vol with exact numbers. Describe the spread size. Describe term structure shape (flat, contango, backwardation, or kinked at a specific date).",
  "notableFlow": "2-3 sentences. If unusual activity exists, describe the specific strikes and volume. If none, say so plainly.",
  "keyRisksAndCatalysts": "2-3 sentences. Only mention catalysts that are in the data (e.g., a known earnings date). Do not speculate about macro events, sector rotation, or unnamed catalysts.",
  "actionableTakeaway": "1-2 sentences. Summarize what the options market is pricing — not what to do about it. If the picture is mixed or unremarkable, say that."
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
