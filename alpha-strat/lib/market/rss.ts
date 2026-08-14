import Parser from "rss-parser";

export interface MacroArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface MacroCategory {
  id: string;
  label: string;
  summary: string;
  articles: MacroArticle[];
}

interface FeedConfig {
  id: string;
  label: string;
  urls: string[];
  filter?: (title: string) => boolean;
}

export const COMMODITY_KEYWORDS = [
  "crude", "oil", "gold", "silver", "wheat", "corn",
  "copper", "metals", "commodity", "commodities",
  "natural gas", "platinum", "iron ore", "soybeans",
];

function commodityFilter(title: string): boolean {
  const lower = title.toLowerCase();
  return COMMODITY_KEYWORDS.some((kw) => lower.includes(kw));
}

export const JOBS_KEYWORDS = [
  "jobs", "employment", "unemployment", "labor", "labour",
  "payroll", "hiring", "workforce", "wage", "wages",
  "nonfarm", "jobless", "cpi", "inflation", "gdp",
  "recession", "economic data", "consumer spending",
];

function jobsFilter(title: string): boolean {
  const lower = title.toLowerCase();
  return JOBS_KEYWORDS.some((kw) => lower.includes(kw));
}

export const FEED_CONFIG: FeedConfig[] = [
  {
    id: "fed",
    label: "Federal Reserve",
    urls: ["https://www.federalreserve.gov/feeds/press_all.xml"],
  },
  {
    id: "geopolitics",
    label: "Geopolitics",
    urls: [
      "https://www.aljazeera.com/xml/rss/all.xml",
      "https://feeds.bbci.co.uk/news/world/rss.xml",
    ],
  },
  {
    id: "commodities",
    label: "Commodities",
    urls: ["https://oilprice.com/rss/main"],
  },
  {
    id: "jobs",
    label: "Jobs & Economic Data",
    urls: [
      "https://feeds.content.dowjones.io/public/rss/mw_topstories",
    ],
  },
  {
    id: "government",
    label: "US Government",
    urls: ["https://www.whitehouse.gov/wire/feed/"],
  },
];

const parser = new Parser();

export function filterRecentArticles(
  articles: MacroArticle[],
  hoursBack: number
): MacroArticle[] {
  const cutoff = Date.now() - hoursBack * 3600 * 1000;
  return articles.filter((a) => {
    if (!a.pubDate) return false;
    const date = new Date(a.pubDate).getTime();
    return !isNaN(date) && date >= cutoff;
  });
}

async function fetchSingleFeed(url: string, source: string): Promise<MacroArticle[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? []).map((item) => ({
      title: item.title ?? "(untitled)",
      link: item.link ?? "",
      pubDate: item.pubDate ?? item.isoDate ?? "",
      source,
    }));
  } catch (err) {
    console.warn(`[rss] failed to fetch ${url}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function fetchMacroFeeds(): Promise<MacroCategory[]> {
  const results = await Promise.allSettled(
    FEED_CONFIG.map(async (config) => {
      const feedPromises = config.urls.map((url) => fetchSingleFeed(url, config.label));
      const feeds = await Promise.allSettled(feedPromises);
      let articles = feeds
        .filter((r): r is PromiseFulfilledResult<MacroArticle[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);

      if (config.filter) {
        articles = articles.filter((a) => config.filter!(a.title));
      }

      articles = filterRecentArticles(articles, 48);
      articles.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());

      return {
        id: config.id,
        label: config.label,
        summary: "",
        articles,
      };
    })
  );

  return results
    .filter((r): r is PromiseFulfilledResult<MacroCategory> => r.status === "fulfilled")
    .map((r) => r.value);
}
