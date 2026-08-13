import { generateCompletion } from "./client";
import { NewsArticle } from "@/lib/market/types";

const NEWS_SUMMARY_SYSTEM = `You are a financial news analyst for a personal finance app. Given numbered news articles for a stock ticker, write a detailed 3-5 sentence summary covering the most important recent developments. Prioritize: management comments or quotes, leadership changes, earnings results, major deals or partnerships, regulatory actions, and significant market moves. Cite every claim using bracket notation [1], [2], etc. matching the article numbers provided. Be factual, specific, and include key figures (dollar amounts, percentages, names) when available. Do not give investment advice. Do not use markdown formatting except for the bracket citations.`;

function buildNewsSummaryPrompt(ticker: string, articles: NewsArticle[]): string {
  const articleLines = articles
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.publisher})`)
    .join("\n");

  return `Recent news for ${ticker}:\n${articleLines}\n\nWrite a detailed summary of the key developments. Include specific details like management quotes, leadership changes, deal sizes, and financial figures where available. Cite every claim with [N] notation.`;
}

export async function generateNewsSummary(
  ticker: string,
  articles: NewsArticle[]
): Promise<string | null> {
  if (articles.length === 0) return null;

  try {
    const userPrompt = buildNewsSummaryPrompt(ticker, articles);
    const summary = await generateCompletion(
      NEWS_SUMMARY_SYSTEM,
      userPrompt,
      "gemini"
    );
    return summary.trim() || null;
  } catch {
    return null;
  }
}
