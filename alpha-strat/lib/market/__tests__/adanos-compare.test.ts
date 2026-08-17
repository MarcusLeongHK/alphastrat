import { describe, it, expect, beforeEach, vi } from "vitest";

describe("getAdanosCompareSentiment", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.ADANOS_API_KEY = "test-key";
    global.fetch = vi.fn();
  });

  it("returns a map of compare results for multiple tickers", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          ticker: "AAPL",
          found: true,
          buzz_score: 72.5,
          trend: "rising",
          mentions: 340,
          sentiment_score: 0.6,
          bullish_pct: 65,
          bearish_pct: 15,
        },
        {
          ticker: "MSFT",
          found: true,
          buzz_score: 40.1,
          trend: "stable",
          mentions: 120,
          sentiment_score: 0.2,
          bullish_pct: 45,
          bearish_pct: 25,
        },
      ],
    });

    const { getAdanosCompareSentiment } = await import("../adanos");
    const result = await getAdanosCompareSentiment(["AAPL", "MSFT"], "reddit");

    expect(result.size).toBe(2);
    expect(result.get("AAPL")).toEqual({
      ticker: "AAPL",
      found: true,
      buzzScore: 72.5,
      trend: "rising",
      mentions: 340,
      sentimentScore: 0.6,
      bullishPct: 65,
      bearishPct: 15,
    });
    expect(result.get("MSFT")?.bullishPct).toBe(45);
  });

  it("returns empty map when API fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({}),
    });

    const { getAdanosCompareSentiment } = await import("../adanos");
    const result = await getAdanosCompareSentiment(["AAPL", "MSFT"], "reddit");

    expect(result.size).toBe(0);
  });

  it("returns empty map when no API key", async () => {
    delete process.env.ADANOS_API_KEY;

    const { getAdanosCompareSentiment } = await import("../adanos");
    const result = await getAdanosCompareSentiment(["AAPL", "MSFT"], "reddit");

    expect(result.size).toBe(0);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
