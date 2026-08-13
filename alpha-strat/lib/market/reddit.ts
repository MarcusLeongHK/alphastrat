import Parser from "rss-parser";

export interface RedditPost {
  title: string;
  selftext: string;
  score: number;
  numComments: number;
  subreddit: string;
  permalink: string;
  createdUtc: number;
  author: string;
}

export interface RedditSentiment {
  ticker: string;
  posts: RedditPost[];
  aiSummary: string | null;
  postCount: number;
  totalScore: number;
  avgScore: number;
}

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const parser = new Parser({
  customFields: {
    item: [["author", "author"]],
  },
});

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const SUBREDDITS = "wallstreetbets+stocks+investing+options+stockmarket";

// Reddit's unauthenticated RSS endpoint rate-limits aggressively when hit
// back-to-back (e.g. clicking Sentiment on two different tickers within a
// few seconds). A single retry with a short backoff after a 429 is usually
// enough to get a real response instead of silently returning [].
const RATE_LIMIT_RETRY_DELAY_MS = 1500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parsePosts(feedItems: Awaited<ReturnType<Parser["parseString"]>>["items"]): RedditPost[] {
  return feedItems.map((item) => ({
    title: item.title ?? "",
    selftext: stripHtml(item.content ?? item.contentSnippet ?? "").slice(
      0,
      500
    ),
    score: 0,
    numComments: 0,
    subreddit: (item.link?.match(/\/r\/([^/]+)/)?.[1]) ?? "unknown",
    permalink: item.link ?? "",
    createdUtc: item.isoDate
      ? Math.floor(new Date(item.isoDate).getTime() / 1000)
      : 0,
    author: (item.creator ?? "").replace("/u/", ""),
  }));
}

async function fetchRedditRss(url: string): Promise<Response> {
  return fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });
}

async function searchRedditRss(
  ticker: string
): Promise<RedditPost[]> {
  const query = encodeURIComponent(ticker);
  const url = `https://www.reddit.com/r/${SUBREDDITS}/search.rss?q=${query}&sort=hot&t=week&restrict_sr=on&limit=25`;

  try {
    let response = await fetchRedditRss(url);

    if (!response.ok) {
      console.warn(
        `[reddit] RSS fetch for ${ticker} returned HTTP ${response.status} ${response.statusText}`
      );

      // Reddit's most common failure mode here is 429 rate limiting from
      // rapid successive requests (e.g. switching tickers quickly). Back off
      // briefly and retry once before giving up.
      if (response.status === 429) {
        await sleep(RATE_LIMIT_RETRY_DELAY_MS);
        response = await fetchRedditRss(url);

        if (!response.ok) {
          console.warn(
            `[reddit] RSS retry for ${ticker} still failed: HTTP ${response.status} ${response.statusText}`
          );
          return [];
        }
      } else {
        return [];
      }
    }

    const xml = await response.text();
    const feed = await parser.parseString(xml);

    return parsePosts(feed.items);
  } catch (err) {
    console.warn(
      `[reddit] RSS fetch for ${ticker} threw an error:`,
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

export async function getRedditPosts(ticker: string): Promise<RedditPost[]> {
  return searchRedditRss(ticker);
}
