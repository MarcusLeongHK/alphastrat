import { describe, it, expect } from "vitest";
import { filterRecentArticles, COMMODITY_KEYWORDS, JOBS_KEYWORDS, FEED_CONFIG } from "./rss";

describe("filterRecentArticles", () => {
  it("keeps articles from the last 48 hours", () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 12 * 3600 * 1000).toISOString();
    const old = new Date(now.getTime() - 72 * 3600 * 1000).toISOString();

    const articles = [
      { title: "Recent", link: "https://a.com", pubDate: recent, source: "Test" },
      { title: "Old", link: "https://b.com", pubDate: old, source: "Test" },
    ];

    const result = filterRecentArticles(articles, 48);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Recent");
  });

  it("handles missing pubDate by excluding the article", () => {
    const articles = [
      { title: "No date", link: "https://a.com", pubDate: "", source: "Test" },
    ];
    const result = filterRecentArticles(articles, 48);
    expect(result).toHaveLength(0);
  });
});

describe("COMMODITY_KEYWORDS", () => {
  it("includes key terms", () => {
    expect(COMMODITY_KEYWORDS).toContain("crude");
    expect(COMMODITY_KEYWORDS).toContain("gold");
    expect(COMMODITY_KEYWORDS).toContain("wheat");
  });
});

describe("JOBS_KEYWORDS", () => {
  it("includes key terms", () => {
    expect(JOBS_KEYWORDS).toContain("unemployment");
    expect(JOBS_KEYWORDS).toContain("cpi");
    expect(JOBS_KEYWORDS).toContain("gdp");
  });
});

describe("FEED_CONFIG", () => {
  it("has 5 categories", () => {
    expect(FEED_CONFIG).toHaveLength(5);
  });

  it("each config has id, label, and urls", () => {
    for (const config of FEED_CONFIG) {
      expect(config.id).toBeTruthy();
      expect(config.label).toBeTruthy();
      expect(config.urls.length).toBeGreaterThan(0);
    }
  });
});
