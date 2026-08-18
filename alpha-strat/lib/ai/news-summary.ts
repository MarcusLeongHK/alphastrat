import { generateCompletion } from "./client";
import type { NewsArticle, StructuredNewsSummary } from "@/lib/market/types";

const NEWS_THEMES_SYSTEM = `You are a financial news analyst. Given numbered news articles for a stock ticker, group them into 2-5 themes and return structured JSON.

Rules:
- Each theme groups related articles
- "label": 1-3 words, noun phrase (e.g. "Court Rulings", "Earnings Beat")
- "summary": exactly one sentence, no citations
- "detail": 2-3 sentences with bracket citations [N] matching input article numbers
- "articleIndices": 1-indexed array matching input article numbers
- Every article must appear in at least one theme
- Be factual and specific — include key figures, names, percentages

Respond with valid JSON only, no markdown fences:
{
  "themes": [
    {
      "label": "Theme Name",
      "summary": "One sentence summary without citations.",
      "detail": "2-3 sentences with [1] bracket citations [2].",
      "articleIndices": [1, 2]
    }
  ]
}`;

function buildNewsThemesPrompt(ticker: string, articles: NewsArticle[]): string {
  const articleLines = articles
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.publisher})`)
    .join("\n");

  return `Recent news for ${ticker}:\n${articleLines}\n\nGroup these articles into themes and return structured JSON.`;
}

export async function generateNewsSummary(
  ticker: string,
  articles: NewsArticle[]
): Promise<StructuredNewsSummary | null> {
  if (articles.length === 0) return null;

  try {
    const userPrompt = buildNewsThemesPrompt(ticker, articles);
    const raw = await generateCompletion(NEWS_THEMES_SYSTEM, userPrompt, "gemini");

    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as StructuredNewsSummary;

    if (!Array.isArray(parsed.themes) || parsed.themes.length === 0) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[news-summary] structured generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
