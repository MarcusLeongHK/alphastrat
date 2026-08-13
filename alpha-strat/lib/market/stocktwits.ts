import { StockTwitsSentiment } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface StockTwitsMessage {
  entities?: {
    sentiment?: {
      basic?: "Bullish" | "Bearish" | string;
    } | null;
  };
}

interface StockTwitsResponse {
  symbol?: {
    sentiment?: {
      label?: string;
    };
  };
  messages?: StockTwitsMessage[];
}

export async function getSentiment(ticker: string): Promise<StockTwitsSentiment> {
  const empty: StockTwitsSentiment = {
    ticker,
    bullish: 0,
    bearish: 0,
    messageCount: 0,
    sentiment: null,
  };

  try {
    const url = `https://api.stocktwits.com/api/2/streams/symbol/${encodeURIComponent(
      ticker,
    )}.json`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) return empty;

    const json = (await response.json()) as StockTwitsResponse;
    const messages = json.messages ?? [];

    let bullishCount = 0;
    let bearishCount = 0;

    for (const message of messages) {
      const basic = message.entities?.sentiment?.basic;
      if (basic === "Bullish") bullishCount++;
      else if (basic === "Bearish") bearishCount++;
    }

    const messageCount = messages.length;
    const labeledCount = bullishCount + bearishCount;

    const bullish = labeledCount > 0 ? (bullishCount / labeledCount) * 100 : 0;
    const bearish = labeledCount > 0 ? (bearishCount / labeledCount) * 100 : 0;

    let sentiment: StockTwitsSentiment["sentiment"] = null;
    if (labeledCount > 0) {
      if (bullish > bearish) sentiment = "bullish";
      else if (bearish > bullish) sentiment = "bearish";
      else sentiment = "neutral";
    }

    return {
      ticker,
      bullish,
      bearish,
      messageCount,
      sentiment,
    };
  } catch {
    return empty;
  }
}
