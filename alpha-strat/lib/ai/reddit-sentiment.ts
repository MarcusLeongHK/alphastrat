import { generateCompletion } from "./client";
import { RedditPost } from "@/lib/market/reddit";

const REDDIT_SENTIMENT_SYSTEM = `You are a retail investor sentiment analyst. Given Reddit posts about a stock ticker from subreddits like r/wallstreetbets, r/stocks, and r/investing, write a concise 2-3 sentence summary of the overall retail sentiment. Include: whether sentiment is bullish, bearish, or mixed; the main reasons or catalysts driving discussion; and any notable consensus or disagreement. Be specific — mention key themes, price targets mentioned by users, or catalysts they're excited/worried about. Do not give investment advice. Do not use markdown formatting.`;

function buildRedditSentimentPrompt(
  ticker: string,
  posts: RedditPost[]
): string {
  const postLines = posts
    .map(
      (p, i) =>
        `[${i + 1}] r/${p.subreddit} (score: ${p.score}, ${p.numComments} comments): "${p.title}"${p.selftext ? ` — "${p.selftext.slice(0, 200)}"` : ""}`
    )
    .join("\n");

  return `Recent Reddit posts about ${ticker}:\n${postLines}\n\nSummarize the overall retail investor sentiment for ${ticker} based on these posts.`;
}

export async function generateRedditSentiment(
  ticker: string,
  posts: RedditPost[]
): Promise<string | null> {
  if (posts.length === 0) return null;

  try {
    const userPrompt = buildRedditSentimentPrompt(ticker, posts);
    const summary = await generateCompletion(
      REDDIT_SENTIMENT_SYSTEM,
      userPrompt,
      "groq"
    );
    return summary.trim() || null;
  } catch {
    return null;
  }
}
