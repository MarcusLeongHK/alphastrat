"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { AnalystData, EarningsData, QuoteData } from "@/lib/market/types";
import type { Tab } from "./tabs/types";
import { TabBar } from "@/app/components/ui/tab-bar";
import { Skeleton } from "@/app/components/ui/skeleton";
import { OverviewTab } from "./tabs/overview-tab";
import { NewsTab } from "./tabs/news-tab";
import { SentimentTab } from "./tabs/sentiment-tab";
import { ThesisTab } from "./tabs/thesis-tab";

function TabSkeleton() {
  return (
    <div className="space-y-3 py-2">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-5 w-36" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

const EarningsTab = dynamic(
  () => import("./tabs/earnings-tab").then((m) => ({ default: m.EarningsTab })),
  { loading: () => <TabSkeleton /> }
);

const OptionsTab = dynamic(
  () => import("./tabs/options-tab").then((m) => ({ default: m.OptionsTab })),
  { loading: () => <TabSkeleton /> }
);

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
    <div className="border-t border-border-primary bg-surface-secondary px-4 py-4">
      <div className="mb-4">
        <TabBar
          tabs={TABS}
          activeTab={activeTab}
          onChange={(key) => setActiveTab(key as Tab)}
        />
      </div>

      <div key={activeTab} className="animate-fade-in">
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
    </div>
  );
}
