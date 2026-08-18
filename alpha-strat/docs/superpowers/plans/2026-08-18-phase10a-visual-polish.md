# Phase 10a: Visual Polish + News Themes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace prose-heavy thesis, news, and macro sections with structured, visual, mobile-responsive components — no new API keys or services.

**Architecture:** Restructure AI prompts to return JSON with summary/structured fields alongside existing full-text fields. Add new interfaces for structured data. Update UI components with gauges, collapsible cards, theme chips, and sentiment badges. All changes are backward-compatible with existing cached data via fallback rendering.

**Tech Stack:** Next.js 16.3, React 19, TypeScript, Tailwind CSS v4, Gemini Flash Lite (AI), Supabase cache

## Global Constraints

- React 19 lint rules: never access refs during render, never setState synchronously in effects. Use `useState` for previous-value tracking.
- All touch targets >= 44px on mobile.
- Mobile-first: collapsed-by-default, expand-on-tap.
- Backward compatibility: old cached data (missing new fields) must render with fallback UI. New fields are optional at the type level where needed.
- No new API calls — same Gemini/Groq calls, just restructured prompts.
- `cookies()` is async in Next.js 16.
- Follow existing code patterns (Tailwind classes, component structure, dark mode).
- Test with `npx tsc --noEmit` and `npm run lint` after each task.

---

### Task 1: Thesis Types + AI Prompt Changes

**Files:**
- Modify: `alpha-strat/lib/market/types.ts:143-156`
- Modify: `alpha-strat/lib/ai/thesis.ts:1-37` (prompt) and `alpha-strat/lib/ai/thesis.ts:144-185` (parsing)
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: existing `ThesisResponse`, `TickerFundamentals` types
- Produces: updated `ThesisResponse` with `bullSummary?: string`, `bearSummary?: string`, `baseSummary?: string`

- [ ] **Step 1: Add summary fields to ThesisResponse**

In `alpha-strat/lib/market/types.ts`, add three optional fields to `ThesisResponse`:

```typescript
export interface ThesisResponse {
  ticker: string;
  rating: "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "Insufficient Data";
  ratingRationale: string;
  bullCase: string;
  bearCase: string;
  baseCase: string;
  bullSummary?: string;
  bearSummary?: string;
  baseSummary?: string;
  keyMetrics: Array<{
    label: string;
    value: string;
    context: string;
  }>;
  generatedAt: string;
}
```

- [ ] **Step 2: Update thesis system prompt**

In `alpha-strat/lib/ai/thesis.ts`, update the JSON schema in `THESIS_SYSTEM_PROMPT` (line ~27-37). Add three summary fields to the JSON structure instruction:

```json
{
  "rating": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "Insufficient Data",
  "ratingRationale": "1-2 sentences citing the key numbers that drive this rating",
  "bullCase": "4-6 sentences, each citing specific data",
  "bearCase": "4-6 sentences, each citing specific data",
  "baseCase": "4-6 sentences, each citing specific data",
  "bullSummary": "One sentence capturing the core bull thesis",
  "bearSummary": "One sentence capturing the core bear thesis",
  "baseSummary": "One sentence capturing the core base case",
  "keyMetrics": [
    { "label": "metric name", "value": "formatted value", "context": "comparison to benchmark" }
  ]
}
```

- [ ] **Step 3: Add fallback extraction in generateThesis**

In `alpha-strat/lib/ai/thesis.ts`, in the `generateThesis` function's try block (line ~163-172), add fallback logic: if the AI doesn't return summaries, take the first sentence of each case paragraph.

```typescript
function extractFirstSentence(text: string): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  return match ? match[0].trim() : text.slice(0, 100);
}
```

In the return object inside the try block, add:

```typescript
bullSummary: parsed.bullSummary || extractFirstSentence(parsed.bullCase || ""),
bearSummary: parsed.bearSummary || extractFirstSentence(parsed.bearCase || ""),
baseSummary: parsed.baseSummary || extractFirstSentence(parsed.baseCase || ""),
```

In the catch block's fallback return, add:

```typescript
bullSummary: "Unable to generate summary.",
bearSummary: "Unable to generate summary.",
baseSummary: "Unable to generate summary.",
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS (no type errors)

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add alpha-strat/lib/market/types.ts alpha-strat/lib/ai/thesis.ts
git commit -m "feat(thesis): add bull/bear/base summary fields to prompt and types"
```

---

### Task 2: News AI Rewrite + API Route Update

**Files:**
- Modify: `alpha-strat/lib/market/types.ts:51-55`
- Modify: `alpha-strat/lib/ai/news-summary.ts` (full rewrite)
- Modify: `alpha-strat/app/api/market/news/route.ts`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `NewsArticle` from `lib/market/types.ts`
- Produces: `NewsTheme` interface, `StructuredNewsSummary` interface, updated `TickerNews` with `themes: NewsTheme[] | null`, updated `generateNewsSummary` returning `StructuredNewsSummary | null`

- [ ] **Step 1: Add NewsTheme and update TickerNews in types.ts**

In `alpha-strat/lib/market/types.ts`, add above the `TickerNews` interface:

```typescript
export interface NewsTheme {
  label: string;
  summary: string;
  detail: string;
  articleIndices: number[];
}

export interface StructuredNewsSummary {
  themes: NewsTheme[];
}
```

Update `TickerNews`:

```typescript
export interface TickerNews {
  ticker: string;
  articles: NewsArticle[];
  aiSummary: string | null;
  themes?: NewsTheme[] | null;
}
```

- [ ] **Step 2: Rewrite news-summary.ts**

Replace the entire content of `alpha-strat/lib/ai/news-summary.ts`:

```typescript
import { generateCompletion } from "./client";
import type { NewsArticle, StructuredNewsSummary } from "@/lib/market/types";

const NEWS_THEMES_SYSTEM = `You are a financial news analyst. Given numbered news articles for a stock ticker, group them into 2-5 themes and return structured JSON.

Rules:
- Each theme groups related articles
- "label": 1-3 words, noun phrase (e.g. "Court Rulings", "Earnings Beat")
- "summary": exactly one sentence, no citations
- "detail": 2-3 sentences with bracket citations [N] matching input article numbers
- "articleIndices": 1-indexed array matching input article numbers
- Every article must appear in at least one theme
- Be factual and specific — include key figures, names, percentages

Respond with valid JSON only, no markdown fences:
{
  "themes": [
    {
      "label": "Theme Name",
      "summary": "One sentence summary without citations.",
      "detail": "2-3 sentences with [1] bracket citations [2].",
      "articleIndices": [1, 2]
    }
  ]
}`;

function buildNewsThemesPrompt(ticker: string, articles: NewsArticle[]): string {
  const articleLines = articles
    .map((a, i) => `[${i + 1}] "${a.title}" (${a.publisher})`)
    .join("\n");

  return `Recent news for ${ticker}:\n${articleLines}\n\nGroup these articles into themes and return structured JSON.`;
}

export async function generateNewsSummary(
  ticker: string,
  articles: NewsArticle[]
): Promise<StructuredNewsSummary | null> {
  if (articles.length === 0) return null;

  try {
    const userPrompt = buildNewsThemesPrompt(ticker, articles);
    const raw = await generateCompletion(NEWS_THEMES_SYSTEM, userPrompt, "gemini");

    const cleaned = raw
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .trim();

    const parsed = JSON.parse(cleaned) as StructuredNewsSummary;

    if (!Array.isArray(parsed.themes) || parsed.themes.length === 0) {
      return null;
    }

    return parsed;
  } catch (err) {
    console.warn("[news-summary] structured generation failed:", err instanceof Error ? err.message : err);
    return null;
  }
}
```

- [ ] **Step 3: Update news API route**

In `alpha-strat/app/api/market/news/route.ts`, update the import and the AI summary cache block to handle the new structured response. The cache key changes to `news-themes:${ticker}` so old `news-summary:*` cache entries don't conflict.

Replace the `aiSummary` cache block and `tickerNews` construction:

```typescript
import { generateNewsSummary } from "@/lib/ai/news-summary";
import type { NewsArticle, TickerNews, StructuredNewsSummary } from "@/lib/market/types";

// ... inside the try block, after fetching articles:

const { data: structured } = await getOrFetch<StructuredNewsSummary | null>(
  supabase,
  `news-themes:${ticker}`,
  "news-summary",
  NEWS_TTL,
  () => generateNewsSummary(ticker, articles)
);

const aiSummary = structured
  ? structured.themes.map((t) => t.summary).join(" ")
  : null;

const tickerNews: TickerNews = {
  ticker,
  articles,
  aiSummary,
  themes: structured?.themes ?? null,
};
```

- [ ] **Step 4: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add alpha-strat/lib/market/types.ts alpha-strat/lib/ai/news-summary.ts alpha-strat/app/api/market/news/route.ts
git commit -m "feat(news): restructure AI to return themed JSON with labels, summaries, and details"
```

---

### Task 3: Macro AI Prompt Restructure

**Files:**
- Modify: `alpha-strat/lib/ai/macro-summary.ts`
- Modify: `alpha-strat/app/api/macro/news/route.ts:8-12`
- Test: `npx tsc --noEmit`

**Interfaces:**
- Consumes: `MacroCategory` from `lib/market/rss.ts`
- Produces: updated `MacroSummaryResult` with `categories[].oneLiner` and structured `macroOutlook` object

- [ ] **Step 1: Update MacroSummaryResult interface**

In `alpha-strat/lib/ai/macro-summary.ts`, replace the interface (lines 4-7):

```typescript
export interface MacroOutlook {
  sentimentLabel: "Bullish" | "Cautious" | "Bearish" | "Mixed";
  headline: string;
  keyDrivers: string[];
}

export interface MacroSummaryResult {
  categories: { id: string; oneLiner: string; summary: string }[];
  macroOutlook: MacroOutlook;
}
```

- [ ] **Step 2: Update the system prompt**

In `alpha-strat/lib/ai/macro-summary.ts`, update `MACRO_SYSTEM_PROMPT` (lines 9-16) to request the new structure:

```typescript
const MACRO_SYSTEM_PROMPT = `You are a macro-economic analyst writing for sophisticated investors. Given recent news headlines grouped by category, produce a JSON response with:

1. "categories" — an array where each entry has:
   - "id" (matching the category ID provided)
   - "oneLiner" (one sentence headline-style summary of the category, max 15 words)
   - "summary" (a thorough 4-6 sentence analysis — not a list of headlines, but what they mean for markets)
2. "macroOutlook" — an object with:
   - "sentimentLabel": one of "Bullish", "Cautious", "Bearish", or "Mixed"
   - "headline": one sentence cross-category synthesis (max 20 words)
   - "keyDrivers": array of 3-5 short phrases (2-5 words each) identifying the key macro drivers

Write with conviction. Be specific about implications. No hedging language. Every sentence should add signal.

Respond with valid JSON only, no markdown fences.`;
```

- [ ] **Step 3: Update fallback returns**

In `alpha-strat/lib/ai/macro-summary.ts`, update all fallback return values in `generateMacroSummary` to match the new interface:

Empty data fallback (line ~39-42):
```typescript
return {
  categories: categories.map((c) => ({ id: c.id, oneLiner: "", summary: "" })),
  macroOutlook: { sentimentLabel: "Mixed" as const, headline: "", keyDrivers: [] },
};
```

Parse warning fallback (line ~51-54):
```typescript
return {
  categories: categories.map((c) => ({ id: c.id, oneLiner: "", summary: "" })),
  macroOutlook: { sentimentLabel: "Mixed" as const, headline: "", keyDrivers: [] },
};
```

Catch block fallback (line ~61-64):
```typescript
return {
  categories: categories.map((c) => ({ id: c.id, oneLiner: "", summary: "" })),
  macroOutlook: { sentimentLabel: "Mixed" as const, headline: "", keyDrivers: [] },
};
```

- [ ] **Step 4: Update validation check**

In `generateMacroSummary`, update the validation check (line ~51) from:
```typescript
if (!parsed.categories || !parsed.macroOutlook) {
```
to:
```typescript
if (!parsed.categories || !parsed.macroOutlook || typeof parsed.macroOutlook === "string") {
```

This handles the case where old-format responses (macroOutlook as string) are returned.

- [ ] **Step 5: Update MacroNewsResponse in the API route**

In `alpha-strat/app/api/macro/news/route.ts`, update the `MacroNewsResponse` interface (lines 8-12):

```typescript
import type { MacroOutlook } from "@/lib/ai/macro-summary";

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: MacroOutlook;
  generatedAt: string;
}
```

Update the enrichment logic inside the `getOrFetch` callback (line ~33-38) to pass through `oneLiner`:

```typescript
const enrichedCategories = categories.map((cat) => {
  const match = summaryResult.categories.find((s) => s.id === cat.id);
  return {
    ...cat,
    summary: match?.summary ?? "",
    oneLiner: match?.oneLiner ?? "",
  };
});
```

Note: The `MacroCategory` type from `lib/market/rss.ts` may need an `oneLiner` field. Check and add `oneLiner?: string` to the `MacroCategory` interface if it doesn't have one. If `MacroCategory` is an interface in `lib/market/rss.ts`, add `oneLiner?: string` to it.

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add alpha-strat/lib/ai/macro-summary.ts alpha-strat/app/api/macro/news/route.ts alpha-strat/lib/market/rss.ts
git commit -m "feat(macro): restructure AI prompt for oneLiner + structured outlook object"
```

---

### Task 4: Thesis Tab UI Overhaul

**Files:**
- Modify: `alpha-strat/app/watchlist/ticker-detail-panel.tsx:1167-1271`
- Test: dev server verification on desktop and mobile viewport

**Interfaces:**
- Consumes: `ThesisResponse` with `bullSummary?`, `bearSummary?`, `baseSummary?`, `rating`

- [ ] **Step 1: Add the RatingGauge component**

Create the `RatingGauge` component inside `ticker-detail-panel.tsx` (or as a section within the thesis tab rendering). Add it near the existing thesis helper functions.

```typescript
const RATING_POSITIONS: Record<string, number> = {
  "Strong Sell": 0,
  "Sell": 1,
  "Hold": 2,
  "Buy": 3,
  "Strong Buy": 4,
  "Insufficient Data": 2,
};

const RATING_LABELS_FULL = ["Strong Sell", "Sell", "Hold", "Buy", "Strong Buy"];
const RATING_LABELS_SHORT = ["SS", "S", "H", "B", "SB"];

function RatingGauge({ rating }: { rating: string }) {
  const position = RATING_POSITIONS[rating] ?? 2;
  const pct = (position / 4) * 100;

  return (
    <div className="w-full">
      <div className="relative h-2 rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-500">
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${pct}%` }}
        >
          <div className="h-4 w-4 rounded-full border-2 border-white bg-zinc-900 shadow dark:border-zinc-900 dark:bg-white" />
        </div>
      </div>
      <div className="mt-1.5 flex justify-between">
        {RATING_LABELS_FULL.map((label, i) => (
          <span
            key={label}
            className={`text-[9px] md:text-[10px] ${
              i === position
                ? "font-semibold text-zinc-900 dark:text-zinc-100"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            <span className="hidden md:inline">{label}</span>
            <span className="md:hidden">{RATING_LABELS_SHORT[i]}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the VerdictBar component**

```typescript
const VERDICT_WEIGHTS: Record<string, [number, number]> = {
  "Strong Buy": [90, 10],
  "Buy": [70, 30],
  "Hold": [50, 50],
  "Sell": [30, 70],
  "Strong Sell": [10, 90],
  "Insufficient Data": [50, 50],
};

function VerdictBar({ rating }: { rating: string }) {
  const [bull, bear] = VERDICT_WEIGHTS[rating] ?? [50, 50];

  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-emerald-600 dark:text-emerald-400">Bull</span>
      <div className="flex h-2 flex-1 overflow-hidden rounded-full">
        <div className="bg-emerald-500" style={{ width: `${bull}%` }} />
        <div className="bg-red-500" style={{ width: `${bear}%` }} />
      </div>
      <span className="text-[10px] text-red-600 dark:text-red-400">Bear</span>
    </div>
  );
}
```

- [ ] **Step 3: Add the CaseAccordion component**

```typescript
function CaseAccordion({
  thesisData,
}: {
  thesisData: {
    bullCase: string;
    bearCase: string;
    baseCase: string;
    bullSummary?: string;
    bearSummary?: string;
    baseSummary?: string;
  };
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const cases = [
    {
      key: "bull",
      label: "Bull Case",
      borderColor: "border-l-emerald-500 dark:border-l-emerald-400",
      labelColor: "text-emerald-600 dark:text-emerald-400",
      summary: thesisData.bullSummary || thesisData.bullCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.bullCase,
    },
    {
      key: "bear",
      label: "Bear Case",
      borderColor: "border-l-red-500 dark:border-l-red-400",
      labelColor: "text-red-600 dark:text-red-400",
      summary: thesisData.bearSummary || thesisData.bearCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.bearCase,
    },
    {
      key: "base",
      label: "Base Case",
      borderColor: "border-l-amber-500 dark:border-l-amber-400",
      labelColor: "text-amber-600 dark:text-amber-400",
      summary: thesisData.baseSummary || thesisData.baseCase.split(/[.!?]/)[0] + ".",
      detail: thesisData.baseCase,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {cases.map((c) => {
        const isExpanded = expanded === c.key;
        return (
          <div
            key={c.key}
            className={`rounded-lg border border-l-4 border-zinc-200 ${c.borderColor} dark:border-zinc-800`}
          >
            <button
              onClick={() => setExpanded(isExpanded ? null : c.key)}
              className="flex min-h-[44px] w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex-1">
                <h4 className={`text-xs font-semibold uppercase tracking-wider ${c.labelColor}`}>
                  {c.label}
                </h4>
                {!isExpanded && (
                  <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400 line-clamp-1">
                    {c.summary}
                  </p>
                )}
              </div>
              <svg
                className={`ml-2 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {isExpanded && (
              <div className="border-t border-zinc-100 px-4 pb-4 pt-3 dark:border-zinc-800">
                <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
                  {c.detail}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Replace thesis tab rendering**

Replace the thesis tab content (lines ~1184-1271, the `thesisData` truthy branch) with:

```tsx
<>
  {/* Rating Gauge */}
  <div className={`rounded-lg border p-4 ${thesisRatingBg(thesisData.rating)}`}>
    <div className="flex items-baseline justify-between mb-3">
      <span className={`text-xl font-bold ${thesisRatingColor(thesisData.rating)}`}>
        {thesisData.rating}
      </span>
      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
        Investment Rating
      </span>
    </div>
    <RatingGauge rating={thesisData.rating} />
    <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
      {thesisData.ratingRationale}
    </p>
    <div className="mt-3">
      <VerdictBar rating={thesisData.rating} />
    </div>
  </div>

  {/* Key Metrics Grid — unchanged */}
  {thesisData.keyMetrics.length > 0 && (
    <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Key Metrics
      </h4>
      <div className="grid grid-cols-2 gap-3">
        {thesisData.keyMetrics.map((metric, i) => (
          <div key={i} className="flex flex-col">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {metric.label}
            </span>
            <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {metric.value}
            </span>
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
              {metric.context}
            </span>
          </div>
        ))}
      </div>
    </div>
  )}

  {/* Bull/Bear/Base Accordion */}
  <CaseAccordion thesisData={thesisData} />

  {/* Footer */}
  <div className="flex items-center justify-between">
    <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
      Generated {timeAgo(thesisData.generatedAt)}
    </span>
    <button
      onClick={handleThesisRefresh}
      className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium text-zinc-500 hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
    >
      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      Refresh
    </button>
  </div>
</>
```

- [ ] **Step 5: Update local ThesisResponse-like type**

The component may reference `thesisData` typed inline or via a local interface. Add `bullSummary?: string`, `bearSummary?: string`, `baseSummary?: string` to whatever type it uses for thesis data. Search for `thesisData` state declaration and update its type.

- [ ] **Step 6: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 7: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add alpha-strat/app/watchlist/ticker-detail-panel.tsx
git commit -m "feat(thesis): add rating gauge, verdict bar, and collapsible case cards"
```

---

### Task 5: News Tab UI Overhaul

**Files:**
- Modify: `alpha-strat/app/watchlist/ticker-detail-panel.tsx:918-996`
- Test: dev server verification on desktop and mobile viewport

**Interfaces:**
- Consumes: `TickerNews` with `themes?: NewsTheme[] | null`, existing `renderCitedSummary` function, `NewsTheme` interface

- [ ] **Step 1: Update local TickerNews interface**

In `ticker-detail-panel.tsx`, the local `TickerNews` interface (lines ~31-36) needs updating. Add:

```typescript
interface NewsTheme {
  label: string;
  summary: string;
  detail: string;
  articleIndices: number[];
}

interface TickerNews {
  ticker: string;
  articles: NewsArticle[];
  aiSummary: string | null;
  themes?: NewsTheme[] | null;
}
```

- [ ] **Step 2: Add the NewsThemeChips component**

Add this component in `ticker-detail-panel.tsx`:

```typescript
function NewsThemeChips({
  themes,
  articles,
  renderCitedSummary,
}: {
  themes: NewsTheme[];
  articles: NewsArticle[];
  renderCitedSummary: (text: string, articles: NewsArticle[]) => ReactNode;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showAllSources, setShowAllSources] = useState(false);
  const selected = themes[selectedIndex];
  const filteredArticles = selected
    ? selected.articleIndices.map((idx) => articles[idx - 1]).filter(Boolean)
    : [];

  return (
    <div className="flex flex-col gap-3">
      {/* Theme chips row */}
      <div className="flex gap-2 overflow-x-auto md:flex-wrap scrollbar-hide" style={{ WebkitOverflowScrolling: "touch" }}>
        {themes.map((theme, i) => (
          <button
            key={i}
            onClick={() => { setSelectedIndex(i); setShowAllSources(false); }}
            className={`min-h-[44px] shrink-0 rounded-full px-3 py-1.5 text-xs font-medium border transition-colors ${
              i === selectedIndex
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:border-zinc-400 dark:border-zinc-600 dark:text-zinc-400 dark:hover:border-zinc-500"
            }`}
          >
            {theme.label}
          </button>
        ))}
      </div>

      {/* Selected theme detail */}
      {selected && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
            {renderCitedSummary(selected.detail, articles)}
          </p>

          {/* Filtered sources */}
          <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
              Related Sources
            </div>
            <div className="flex flex-col gap-1">
              {(showAllSources ? articles : filteredArticles).map((article, i) => {
                const originalIndex = showAllSources
                  ? i
                  : selected.articleIndices[i] - 1;
                return (
                  <a
                    key={originalIndex}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-1.5 text-xs text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
                  >
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      [{originalIndex + 1}]
                    </span>
                    <span className="truncate group-hover:underline">
                      {article.title}
                    </span>
                    <span className="hidden shrink-0 text-zinc-300 dark:text-zinc-600 md:inline">
                      — {article.publisher}
                    </span>
                  </a>
                );
              })}
            </div>
            {!showAllSources && filteredArticles.length < articles.length && (
              <button
                onClick={() => setShowAllSources(true)}
                className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Show all {articles.length} sources
              </button>
            )}
            {showAllSources && (
              <button
                onClick={() => setShowAllSources(false)}
                className="mt-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Show related only
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Replace news tab rendering**

Replace the news tab content (lines ~918-996) with logic that checks for themes first, falls back to existing rendering:

```tsx
{activeTab === "news" && (
  <div className="flex flex-col gap-4">
    {newsLoading ? (
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800"
          />
        ))}
      </div>
    ) : news ? (
      <>
        {news.themes && news.themes.length > 0 && news.articles.length > 0 ? (
          <NewsThemeChips
            themes={news.themes}
            articles={news.articles}
            renderCitedSummary={renderCitedSummary}
          />
        ) : news.aiSummary && news.articles.length > 0 ? (
          /* Fallback: old cached data without themes */
          <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              <span aria-hidden="true">✦</span> News Summary
            </h4>
            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
              {renderCitedSummary(news.aiSummary, news.articles)}
            </p>
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-1.5">
                Sources
              </div>
              <div className="flex flex-col gap-1">
                {news.articles.map((article, i) => (
                  <a
                    key={i}
                    href={article.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-baseline gap-1.5 text-xs text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 transition-colors"
                  >
                    <span className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500">
                      [{i + 1}]
                    </span>
                    <span className="truncate group-hover:underline">
                      {article.title}
                    </span>
                    <span className="hidden shrink-0 text-zinc-300 dark:text-zinc-600 md:inline">
                      — {article.publisher}, {timeAgo(article.publishedAt)}
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        ) : news.articles.length > 0 ? (
          <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs text-zinc-400 mb-2">
              Summary unavailable. Recent articles:
            </p>
            <div className="flex flex-col gap-1">
              {news.articles.map((article, i) => (
                <a
                  key={i}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-zinc-700 hover:text-blue-500 dark:text-zinc-300 dark:hover:text-blue-400"
                >
                  {article.title}
                  <span className="ml-1 text-xs text-zinc-400">
                    ({article.publisher})
                  </span>
                </a>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-zinc-400">No recent news found</p>
        )}
      </>
    ) : (
      <p className="text-xs text-zinc-400">Unable to load news</p>
    )}
  </div>
)}
```

- [ ] **Step 4: Add scrollbar-hide CSS if not present**

Check if `scrollbar-hide` utility exists in the project's CSS. If not, add to `globals.css`:

```css
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
```

- [ ] **Step 5: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add alpha-strat/app/watchlist/ticker-detail-panel.tsx alpha-strat/app/globals.css
git commit -m "feat(news): add theme chips with expandable details and filtered sources"
```

---

### Task 6: Macro Dashboard UI Overhaul

**Files:**
- Modify: `alpha-strat/app/macro/macro-dashboard.tsx`
- Test: dev server verification on desktop and mobile viewport

**Interfaces:**
- Consumes: updated `MacroNewsResponse` with structured `macroOutlook` and `categories[].oneLiner`

- [ ] **Step 1: Update local MacroNewsResponse interface**

In `alpha-strat/app/macro/macro-dashboard.tsx`, update the local interfaces (lines 5-23):

```typescript
interface MacroOutlookData {
  sentimentLabel: string;
  headline: string;
  keyDrivers: string[];
}

interface MacroCategory {
  id: string;
  label: string;
  summary: string;
  oneLiner?: string;
  articles: MacroArticle[];
}

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string | MacroOutlookData;
  generatedAt: string;
}
```

The `macroOutlook` is `string | MacroOutlookData` for backward compatibility with old cached responses.

- [ ] **Step 2: Add sentiment badge color helper**

Add near the other helper functions:

```typescript
const SENTIMENT_STYLES: Record<string, { bg: string; text: string }> = {
  Bullish: {
    bg: "bg-emerald-100 dark:bg-emerald-900/50",
    text: "text-emerald-700 dark:text-emerald-300",
  },
  Cautious: {
    bg: "bg-amber-100 dark:bg-amber-900/50",
    text: "text-amber-700 dark:text-amber-300",
  },
  Bearish: {
    bg: "bg-red-100 dark:bg-red-900/50",
    text: "text-red-700 dark:text-red-300",
  },
  Mixed: {
    bg: "bg-zinc-100 dark:bg-zinc-800",
    text: "text-zinc-600 dark:text-zinc-300",
  },
};
```

- [ ] **Step 3: Replace the Macro Outlook hero card**

Replace the current outlook section (lines ~464-495) with logic that handles both old (string) and new (object) formats:

```tsx
{/* Macro Outlook Hero */}
<div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
  <div className="flex items-center justify-between">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
      Macro Outlook
    </h2>
    <div className="flex items-center gap-3">
      {data.generatedAt && (
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          Updated {timeAgo(data.generatedAt)}
        </span>
      )}
      <button
        onClick={() => setShowSettings((v) => !v)}
        className={`flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md p-1.5 transition-colors ${
          showSettings
            ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
            : "text-zinc-400 hover:bg-zinc-200 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
        }`}
        title="Customize sections"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </button>
    </div>
  </div>

  {typeof data.macroOutlook === "string" ? (
    /* Fallback: old cached data */
    <p className="mt-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200">
      {data.macroOutlook || "Insufficient data for analysis."}
    </p>
  ) : (
    /* New structured outlook */
    <div className="mt-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-3">
        {(() => {
          const style = SENTIMENT_STYLES[data.macroOutlook.sentimentLabel] ?? SENTIMENT_STYLES.Mixed;
          return (
            <span className={`inline-flex w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
              {data.macroOutlook.sentimentLabel}
            </span>
          );
        })()}
        <p className="text-base font-medium text-zinc-900 dark:text-zinc-100">
          {data.macroOutlook.headline}
        </p>
      </div>
      {data.macroOutlook.keyDrivers.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {data.macroOutlook.keyDrivers.map((driver, i) => (
            <span
              key={i}
              className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {driver}
            </span>
          ))}
        </div>
      )}
    </div>
  )}
</div>
```

- [ ] **Step 4: Update CategorySection for collapsed-by-default with oneLiner**

In the `CategorySection` component (lines ~134-211), change the initial `expanded` state from `true` to `false`, and add the `oneLiner` display:

Change:
```typescript
const [expanded, setExpanded] = useState(true);
```
To:
```typescript
const [expanded, setExpanded] = useState(false);
```

Update the button content inside `CategorySection` to show `oneLiner` when collapsed:

```tsx
<button
  onClick={() => setExpanded((v) => !v)}
  className="flex w-full items-center justify-between px-5 py-4 text-left"
>
  <div className="flex-1">
    <div className="flex items-center gap-3">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        {category.label}
      </h3>
      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style.badge}`}>
        {category.articles.length}
      </span>
    </div>
    {!expanded && category.oneLiner && (
      <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1">
        {category.oneLiner}
      </p>
    )}
  </div>
  <svg
    className={`ml-2 h-4 w-4 shrink-0 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
  </svg>
</button>
```

- [ ] **Step 5: Update category grid layout**

In the `MacroDashboard` component's return (line ~507), wrap category sections in a responsive grid:

```tsx
{/* Category Sections */}
<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
  {filteredCategories.map((cat) => (
    <CategorySection key={cat.id} category={cat} />
  ))}
</div>
```

- [ ] **Step 6: Hide publisher on mobile in article list**

In `CategorySection`, update the article list item (line ~183-195). Add `hidden md:inline` to the publisher/time span so it's hidden on mobile:

The time `<span>` already exists. Make publisher hidden on mobile:

```tsx
<li key={i} className="group flex items-start justify-between gap-3 py-2">
  <a
    href={article.link}
    target="_blank"
    rel="noopener noreferrer"
    className="text-sm text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-100"
  >
    {article.title}
  </a>
  <span className="hidden shrink-0 text-xs text-zinc-400 dark:text-zinc-500 md:inline">
    {timeAgo(article.pubDate)}
  </span>
</li>
```

- [ ] **Step 7: Verify types compile**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Run lint**

Run: `npm run lint`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add alpha-strat/app/macro/macro-dashboard.tsx
git commit -m "feat(macro): add sentiment badge, driver chips, collapsed categories with one-liners"
```

---

### Task 7: Docs Update + Final Verification

**Files:**
- Modify: `alpha-strat/DECISIONS.md`
- Modify: `alpha-strat/CLAUDE.md`
- Test: full dev server verification (desktop + mobile viewport)

**Interfaces:**
- Consumes: all changes from Tasks 1-6

- [ ] **Step 1: Update DECISIONS.md**

Add a new section to `alpha-strat/DECISIONS.md` documenting the Phase 10a decisions:

```markdown
## Phase 10a: Visual Polish + News Themes (2026-08-18)

### Structured AI prompts over prose
**Decision:** Restructured all three AI prompts (thesis, news, macro) to return JSON with both summary fields and full-text fields.
**Tradeoff:** ~10-20% more output tokens vs dramatically improved UI with visual gauges, collapsible cards, and theme chips.
**Why:** Prose paragraphs are hard to scan on mobile. Structured data enables progressive disclosure (collapsed summaries → expanded details).

### Backward-compatible schema evolution
**Decision:** New fields are optional (`bullSummary?`, `themes?`, `oneLiner?`). Old cached data renders with fallback UI (existing paragraph layout). Cache expires naturally per TTL.
**Tradeoff:** Dual rendering paths vs zero-downtime migration. Old cache entries expire naturally (1hr macro, 4hr news, 7d thesis).
**Why:** Users shouldn't see broken UI just because they have cached data from before the update.

### News cache key change
**Decision:** Changed news AI cache key from `news-summary:${ticker}` to `news-themes:${ticker}`.
**Why:** Old cache entries stored `string`, new ones store `StructuredNewsSummary`. Different key prevents type mismatches on cache hits.

### Accordion vs independent toggles
**Decision:** Thesis cases use accordion (one at a time). Macro categories use independent toggles (multiple open).
**Why:** Thesis cases are mutually exclusive narratives — comparing them side-by-side is rare. Macro categories are independent topics users may want to compare.
```

- [ ] **Step 2: Update CLAUDE.md**

If any new files were created, add them to the Key Files section. Update the existing entries for modified files if their purpose changed.

- [ ] **Step 3: Verify on dev server — desktop**

Start dev server. Navigate to watchlist, select a ticker. Check:
- **Thesis tab:** Rating gauge renders with positioned dot, verdict bar shows bull/bear split, cases are collapsed with summaries visible, expand/collapse works
- **News tab:** Theme chips render as scrollable row, clicking a chip shows detail + filtered sources, "Show all sources" toggle works
- **Macro page:** Outlook card shows sentiment badge + headline + driver chips, categories are collapsed with one-liners, expand shows full summary + articles, grid layout on desktop

- [ ] **Step 4: Verify on dev server — mobile viewport**

Resize to mobile width (375px). Check:
- Rating gauge labels show abbreviated (SS/S/H/B/SB)
- Theme chips scroll horizontally
- Case cards have 44px+ touch targets
- Macro categories stack in single column
- Publisher names hidden on mobile

- [ ] **Step 5: Run full type check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: PASS

- [ ] **Step 6: Run tests**

Run: `npx vitest --run`
Expected: All existing tests pass

- [ ] **Step 7: Commit**

```bash
git add alpha-strat/DECISIONS.md alpha-strat/CLAUDE.md
git commit -m "docs: add Phase 10a decisions and update CLAUDE.md key files"
```
