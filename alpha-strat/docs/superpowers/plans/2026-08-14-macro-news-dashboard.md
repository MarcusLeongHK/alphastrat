# Macro News Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/macro` page that aggregates macro-economic news from 5 categories of RSS feeds, generates per-category AI summaries and a cross-category macro outlook via Gemini Flash Lite, and caches results for 1 hour.

**Architecture:** Single API route (`/api/macro/news`) fetches all RSS feeds in parallel via `Promise.allSettled`, filters to 48hr window, groups by category, passes all headlines to Gemini in one call for per-category summaries + cross-category outlook. Result cached 1hr via existing `getOrFetch<T>()`. Client dashboard renders a hero outlook card + collapsible category sections with headlines.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, rss-parser (already installed), Gemini Flash Lite via `generateCompletion()`, Supabase cache via `getOrFetch<T>()`.

## Global Constraints

- Zero new dependencies — `rss-parser` is already installed
- All API routes require auth via `getClaims()`
- Cache uses composite `(user_id, cache_key)` constraint — always include `user_id` in cache operations
- AI calls use `generateCompletion(systemPrompt, userPrompt, "gemini")` from `lib/ai/client.ts`
- Tailwind v4 — use `zinc` for neutrals, existing dark mode pattern (`dark:` prefix)
- No empty catch blocks — always `console.warn` errors
- `cookies()` is async in Next.js 16
- UI must be clean and polished, not generic — match existing AlphaStrat design language

---

### Task 1: RSS Feed Fetcher (`lib/market/rss.ts`)

**Files:**
- Create: `lib/market/rss.ts`
- Test: `lib/market/rss.test.ts`

**Interfaces:**
- Consumes: `rss-parser` package (already installed, used in `lib/market/reddit.ts`)
- Produces:
  - `MacroArticle` — `{ title: string; link: string; pubDate: string; source: string }`
  - `MacroCategory` — `{ id: string; label: string; articles: MacroArticle[] }`
  - `fetchMacroFeeds()` — `() => Promise<MacroCategory[]>`

- [ ] **Step 1: Write the failing test**

Create `lib/market/rss.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { filterRecentArticles, COMMODITY_KEYWORDS, FEED_CONFIG } from "./rss";

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/market/rss.test.ts`
Expected: FAIL — cannot resolve `./rss` imports.

- [ ] **Step 3: Implement the RSS fetcher**

Create `lib/market/rss.ts`:

```typescript
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

export const FEED_CONFIG: FeedConfig[] = [
  {
    id: "fed",
    label: "Federal Reserve",
    urls: ["https://www.federalreserve.gov/feeds/press_all.xml"],
  },
  {
    id: "geopolitics",
    label: "Geopolitics",
    urls: ["https://feeds.reuters.com/Reuters/worldNews"],
  },
  {
    id: "commodities",
    label: "Commodities",
    urls: ["https://feeds.reuters.com/reuters/businessNews"],
    filter: commodityFilter,
  },
  {
    id: "jobs",
    label: "Jobs & Economic Data",
    urls: ["https://www.bls.gov/feed/bls_latest.rss"],
  },
  {
    id: "government",
    label: "US Government",
    urls: [
      "https://www.whitehouse.gov/feed/",
      "https://home.treasury.gov/system/files/136/Treasury-RSS.xml",
    ],
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/market/rss.test.ts`
Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/market/rss.ts lib/market/rss.test.ts
git commit -m "feat(macro): add RSS feed fetcher with category config and 48hr filter"
```

---

### Task 2: AI Macro Summary (`lib/ai/macro-summary.ts` + cache TTL)

**Files:**
- Create: `lib/ai/macro-summary.ts`
- Modify: `lib/cache/freshness.ts` — add `MACRO_TTL`

**Interfaces:**
- Consumes: `generateCompletion(system, user, "gemini")` from `lib/ai/client.ts`, `MacroCategory` from `lib/market/rss.ts`
- Produces:
  - `MacroSummaryResult` — `{ categories: { id: string; summary: string }[]; macroOutlook: string }`
  - `generateMacroSummary(categories: MacroCategory[])` — `Promise<MacroSummaryResult>`

- [ ] **Step 1: Add `MACRO_TTL` to freshness.ts**

Add this line to `lib/cache/freshness.ts`:

```typescript
export const MACRO_TTL = 3600; // 1 hour — macro news is time-sensitive
```

- [ ] **Step 2: Write the AI summary module**

Create `lib/ai/macro-summary.ts`:

```typescript
import { generateCompletion } from "./client";
import type { MacroCategory } from "@/lib/market/rss";

export interface MacroSummaryResult {
  categories: { id: string; summary: string }[];
  macroOutlook: string;
}

const MACRO_SYSTEM_PROMPT = `You are a macro-economic analyst writing for sophisticated investors. Given recent news headlines grouped by category, produce a JSON response with:

1. "categories" — an array where each entry has "id" (matching the category ID provided) and "summary" (a sharp 2-3 sentence analysis of that category's headlines — not a list of headlines, but what they mean for markets)
2. "macroOutlook" — a 3-4 sentence cross-category synthesis connecting themes, identifying contradictions, and noting what sophisticated investors should watch

Write with conviction. Be specific about implications. No hedging language like "could potentially" or "it remains to be seen." Name specific risks and catalysts.

Respond with valid JSON only, no markdown fences.`;

function buildMacroUserPrompt(categories: MacroCategory[]): string {
  const sections = categories
    .filter((c) => c.articles.length > 0)
    .map((c) => {
      const headlines = c.articles
        .slice(0, 10)
        .map((a) => `- ${a.title}`)
        .join("\n");
      return `## ${c.label} (${c.id})\n${headlines}`;
    })
    .join("\n\n");

  return sections || "No recent headlines available across any category.";
}

export async function generateMacroSummary(
  categories: MacroCategory[]
): Promise<MacroSummaryResult> {
  const hasArticles = categories.some((c) => c.articles.length > 0);
  if (!hasArticles) {
    return {
      categories: categories.map((c) => ({ id: c.id, summary: "" })),
      macroOutlook: "",
    };
  }

  try {
    const userPrompt = buildMacroUserPrompt(categories);
    const raw = await generateCompletion(MACRO_SYSTEM_PROMPT, userPrompt, "gemini");

    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const parsed = JSON.parse(cleaned) as MacroSummaryResult;

    if (!parsed.categories || !parsed.macroOutlook) {
      console.warn("[macro-summary] unexpected AI response shape");
      return {
        categories: categories.map((c) => ({ id: c.id, summary: "" })),
        macroOutlook: "",
      };
    }

    return parsed;
  } catch (err) {
    console.warn("[macro-summary] AI generation failed:", err instanceof Error ? err.message : err);
    return {
      categories: categories.map((c) => ({ id: c.id, summary: "" })),
      macroOutlook: "",
    };
  }
}
```

- [ ] **Step 3: Verify no type errors**

Run: `npx tsc --noEmit --pretty`
Expected: No new errors from the files added.

- [ ] **Step 4: Commit**

```bash
git add lib/ai/macro-summary.ts lib/cache/freshness.ts
git commit -m "feat(macro): add Gemini-powered macro summary with cross-category outlook"
```

---

### Task 3: API Route (`app/api/macro/news/route.ts`)

**Files:**
- Create: `app/api/macro/news/route.ts`

**Interfaces:**
- Consumes: `fetchMacroFeeds()` from `lib/market/rss.ts`, `generateMacroSummary()` from `lib/ai/macro-summary.ts`, `getOrFetch<T>()` from `lib/cache/index.ts`, `MACRO_TTL` from `lib/cache/freshness.ts`, `createClient()` from `lib/supabase/server.ts`
- Produces: `GET` handler returning `MacroNewsResponse` JSON

```typescript
// MacroNewsResponse shape:
{
  categories: MacroCategory[]; // with summaries filled in
  macroOutlook: string;
  generatedAt: string; // ISO timestamp
}
```

- [ ] **Step 1: Create the API route**

Create `app/api/macro/news/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { MACRO_TTL } from "@/lib/cache/freshness";
import { fetchMacroFeeds, type MacroCategory } from "@/lib/market/rss";
import { generateMacroSummary } from "@/lib/ai/macro-summary";

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string;
  generatedAt: string;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await getOrFetch<MacroNewsResponse>(
      supabase,
      "macro-news",
      "macro",
      MACRO_TTL,
      async () => {
        const categories = await fetchMacroFeeds();
        const summaryResult = await generateMacroSummary(categories);

        const enrichedCategories = categories.map((cat) => {
          const match = summaryResult.categories.find((s) => s.id === cat.id);
          return { ...cat, summary: match?.summary ?? "" };
        });

        return {
          categories: enrichedCategories,
          macroOutlook: summaryResult.macroOutlook,
          generatedAt: new Date().toISOString(),
        };
      },
      {
        shouldCache: (result) =>
          result.categories.some((c) => c.articles.length > 0),
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch macro news: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Verify no type errors**

Run: `npx tsc --noEmit --pretty`
Expected: No new errors.

- [ ] **Step 3: Test the endpoint manually**

Start the dev server (`npm run dev`), log in, then visit:
`http://localhost:3000/api/macro/news`

Expected: JSON response with 5 categories, articles, summaries, and a macroOutlook string. Second request within 1hr should be cached.

- [ ] **Step 4: Commit**

```bash
git add app/api/macro/news/route.ts
git commit -m "feat(macro): add cached API route for macro news with AI summaries"
```

---

### Task 4: Macro Dashboard UI (`app/macro/page.tsx` + `app/macro/macro-dashboard.tsx`)

**Files:**
- Create: `app/macro/page.tsx`
- Create: `app/macro/macro-dashboard.tsx`
- Modify: `app/components/header.tsx` — add "Macro" nav link

**Interfaces:**
- Consumes: `GET /api/macro/news` returning `MacroNewsResponse`
- Produces: Rendered `/macro` page with macro outlook hero card + collapsible category sections

- [ ] **Step 1: Create the server page component**

Create `app/macro/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MacroDashboard } from "./macro-dashboard";

export default async function MacroPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Macro Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Cross-market news and macro outlook, refreshed hourly.
      </p>

      <div className="mt-8">
        <MacroDashboard />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the client dashboard component**

Create `app/macro/macro-dashboard.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

interface MacroArticle {
  title: string;
  link: string;
  pubDate: string;
  source: string;
}

interface MacroCategory {
  id: string;
  label: string;
  summary: string;
  articles: MacroArticle[];
}

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string;
  generatedAt: string;
}

const CATEGORY_STYLES: Record<string, { accent: string; bg: string; badge: string }> = {
  fed: {
    accent: "border-l-violet-500 dark:border-l-violet-400",
    bg: "bg-violet-50 dark:bg-violet-950/30",
    badge: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
  },
  geopolitics: {
    accent: "border-l-rose-500 dark:border-l-rose-400",
    bg: "bg-rose-50 dark:bg-rose-950/30",
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
  },
  commodities: {
    accent: "border-l-amber-500 dark:border-l-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
  },
  jobs: {
    accent: "border-l-emerald-500 dark:border-l-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/30",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
  },
  government: {
    accent: "border-l-blue-500 dark:border-l-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
  },
};

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function OutlookSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
      <div className="h-4 w-32 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-4 space-y-2">
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-4/6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="animate-pulse space-y-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <div className="h-4 w-40 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="mt-3 space-y-2">
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-4/6 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}

function CategorySection({ category }: { category: MacroCategory }) {
  const [expanded, setExpanded] = useState(true);
  const style = CATEGORY_STYLES[category.id] ?? CATEGORY_STYLES.government;

  return (
    <div className={`rounded-lg border border-zinc-200 border-l-4 ${style.accent} dark:border-zinc-800`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            {category.label}
          </h3>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
            {category.articles.length} {category.articles.length === 1 ? "article" : "articles"}
          </span>
        </div>
        <svg
          className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-100 px-5 pb-4 pt-3 dark:border-zinc-800">
          {category.summary && (
            <p className={`mb-4 rounded-md px-3 py-2.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 ${style.bg}`}>
              {category.summary}
            </p>
          )}

          {category.articles.length === 0 ? (
            <p className="text-sm text-zinc-400 dark:text-zinc-500">
              No recent articles in this category.
            </p>
          ) : (
            <ul className="space-y-2">
              {category.articles.map((article, i) => (
                <li key={i} className="group flex items-start justify-between gap-3">
                  <a
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
                  >
                    {article.title}
                  </a>
                  <span className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
                    {timeAgo(article.pubDate)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function MacroDashboard() {
  const [data, setData] = useState<MacroNewsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/macro/news")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: MacroNewsResponse) => {
        setData(json);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load macro news");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <OutlookSkeleton />
        {Array.from({ length: 5 }).map((_, i) => (
          <CategorySkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800/50 dark:bg-red-950/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Macro Outlook Hero */}
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Macro Outlook
          </h2>
          {data.generatedAt && (
            <span className="text-xs text-zinc-400 dark:text-zinc-500">
              Updated {timeAgo(data.generatedAt)}
            </span>
          )}
        </div>
        <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
          {data.macroOutlook || "Insufficient data for analysis."}
        </p>
      </div>

      {/* Category Sections */}
      {data.categories.map((cat) => (
        <CategorySection key={cat.id} category={cat} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Add "Macro" to the header navigation**

In `app/components/header.tsx`, add a `Macro` link between the `Watchlist` and `MarketStatus` links. Inside the `{user ? ( <> ... </> )}` block, after the Watchlist `<Link>` and before `<MarketStatus />`, add:

```tsx
<Link
  href="/macro"
  className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
>
  Macro
</Link>
```

- [ ] **Step 4: Verify no type errors**

Run: `npx tsc --noEmit --pretty`
Expected: No new errors.

- [ ] **Step 5: Test in browser**

Start the dev server (`npm run dev`), log in, navigate to `/macro`.

Verify:
- Skeleton loading state appears while data loads
- Macro Outlook hero card renders with AI synthesis text
- All 5 category sections render with colored left border
- Category summaries appear in muted color-tinted card
- Headlines are clickable external links with relative timestamps
- Sections collapse/expand on click
- "Updated X ago" timestamp shows in outlook card
- Header nav shows "Macro" link and navigates correctly
- Dark mode looks correct (toggle if available, or check via browser devtools `prefers-color-scheme`)

- [ ] **Step 6: Commit**

```bash
git add app/macro/page.tsx app/macro/macro-dashboard.tsx app/components/header.tsx
git commit -m "feat(macro): add macro news dashboard page with category sections and outlook"
```

---

### Task 5: Update DECISIONS.md, CLAUDE.md, and Final Verification

**Files:**
- Modify: `DECISIONS.md` — add decision for Phase 6 implementation
- Modify: `CLAUDE.md` — add macro files to Key Files section

**Interfaces:**
- Consumes: All files created in Tasks 1-4
- Produces: Updated project documentation and verified working feature

- [ ] **Step 1: Add decision to DECISIONS.md**

Append a new decision entry (use the next available number) to `DECISIONS.md`:

```markdown
### Decision [N]: Macro News Dashboard — RSS + Gemini Implementation

**Date:** 2026-08-14
**Status:** Implemented

**Context:** Phase 6 — dedicated macro-economic news page covering Fed, geopolitics, commodities, jobs/economic data, and US government news.

**Decision:** Single API route fetches all RSS feeds in parallel via `Promise.allSettled`, filters to 48hr window, passes to Gemini Flash Lite for per-category summaries + cross-category macro outlook. Cached 1hr via `getOrFetch`.

**Alternatives considered:**
- Per-category API routes (more code, harder to synthesize cross-category outlook)
- ISR static generation (no per-user auth, harder to extend later)
- NewsAPI.org (100 req/day free tier, headlines only, limited gov/Fed coverage)
- Web scraping (fragile — learned from StockTwits Cloudflare blocks)

**Rationale:** RSS is free, reliable, and covers all target sources. Single route keeps the cross-category AI synthesis simple — all data in one prompt. Matches existing architecture pattern (single cached API route per feature).
```

- [ ] **Step 2: Update CLAUDE.md Key Files section**

Add these lines to the Key Files section in `CLAUDE.md`:

```markdown
- `lib/market/rss.ts` — RSS feed fetcher for macro categories (Fed, geopolitics, commodities, jobs, government)
- `lib/ai/macro-summary.ts` — Gemini-powered per-category summaries + cross-category macro outlook
- `app/api/macro/news/route.ts` — macro news API with 1hr cache
- `app/macro/page.tsx` — macro dashboard server component
- `app/macro/macro-dashboard.tsx` — macro dashboard client component with category sections
```

- [ ] **Step 3: Full verification**

Run in order:
1. `npx vitest run` — all tests pass
2. `npx tsc --noEmit --pretty` — no type errors
3. `npm run build` — production build succeeds
4. Manual browser test: navigate to `/macro`, verify all sections render with real data

- [ ] **Step 4: Commit**

```bash
git add DECISIONS.md CLAUDE.md
git commit -m "docs: add Phase 6 macro dashboard decision and update key files"
```
