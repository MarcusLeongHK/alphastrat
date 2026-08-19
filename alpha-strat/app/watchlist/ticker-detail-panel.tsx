"use client";

import { useState } from "react";
import type { AnalystData, EarningsData, QuoteData } from "@/lib/market/types";
import type { Tab } from "./tabs/types";
import { TabBar } from "@/app/components/ui/tab-bar";
import { OverviewTab } from "./tabs/overview-tab";
import { NewsTab } from "./tabs/news-tab";
import { SentimentTab } from "./tabs/sentiment-tab";
import { ThesisTab } from "./tabs/thesis-tab";
import { EarningsTab } from "./tabs/earnings-tab";
import { OptionsTab } from "./tabs/options-tab";

interface TickerDetailPanelProps {
  ticker: string;
  quote: QuoteData | undefined;
  earning: EarningsData | undefined;
  analyst: AnalystData | undefined;
}

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "news", label: "News" },
  { key: "sentiment", label: "Sentiment" },
  { key: "thesis", label: "Thesis" },
  { key: "earnings", label: "Earnings" },
  { key: "options", label: "Options" },
];

export function TickerDetailPanel({
  ticker,
  quote,
  earning,
  analyst,
}: TickerDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="mb-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onChange={(key) => setActiveTab(key as Tab)}
        />
      </div>

      {activeTab === "overview" && (
        <OverviewTab quote={quote} analyst={analyst} earning={earning} />
      )}
      {activeTab === "news" && <NewsTab ticker={ticker} />}
      {activeTab === "sentiment" && (
        <SentimentTab ticker={ticker} analyst={analyst} />
      )}
      {activeTab === "thesis" && <ThesisTab ticker={ticker} />}
      {activeTab === "earnings" && <EarningsTab ticker={ticker} />}
      {activeTab === "options" && <OptionsTab ticker={ticker} />}
    </div>
  );
}
