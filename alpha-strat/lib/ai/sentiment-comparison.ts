import { generateCompletion } from "./client";

const SENTIMENT_COMPARISON_SYSTEM = `You are a financial sentiment analyst. Given a Wall Street analyst consensus rating and a summary of Reddit retail investor sentiment for a stock, write 2-3 sentences comparing the two. State whether retail and institutional sentiment are aligned or divided, and explain the likely reason for any divergence (e.g., retail excitement over catalysts analysts haven't priced in, or analyst caution about risks retail investors are ignoring). Be specific and concise. Do not give investment advice. Do not use markdown formatting.`;

export async function generateSentimentComparison(
  ticker: string,
  analystRating: string,
  numberOfAnalysts: number,
  redditSummary: string
): Promise<string | null> {
  try {
    const userPrompt = `Stock: ${ticker}
Wall Street Analyst Consensus: ${analystRating} (${numberOfAnalysts} analysts)
Reddit Retail Sentiment Summary: ${redditSummary}

Compare the institutional and retail sentiment. Are they aligned or divergent? Explain why.`;

    const result = await generateCompletion(
      SENTIMENT_COMPARISON_SYSTEM,
      userPrompt,
      "groq"
    );
    return result.trim() || null;
  } catch {
    return null;
  }
}
