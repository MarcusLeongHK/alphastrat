# Phase 10a: Visual Polish + News Themes — Design Spec

## Goal

Reduce wordiness across three key sections (thesis tab, news tab, macro dashboard) by replacing prose paragraphs with structured, visual, mobile-responsive components. No new API keys or services — only restructuring AI prompts and UI rendering.

## Scope

Three features, all frontend + AI prompt changes:

1. **Thesis tab visual overhaul** — rating gauge, collapsible bull/bear/base cards, verdict bar
2. **News tab theme buttons** — structured AI response with clickable theme chips and expandable details
3. **Macro dashboard visual overhaul** — compact outlook card with sentiment badge + driver chips, collapsed category cards with one-liners

Out of scope: world map, portfolio analytics, comparison mode, earnings calendar (Phase 10b/10c).

---

## Feature 1: Thesis Tab Visual Overhaul

### Current state

The thesis tab renders four blocks of text: a rating header with rationale paragraph, a key metrics grid (already compact), and three full paragraphs for bull/bear/base cases. All text, no visual elements.

### Changes

#### 1.1 Rating gauge

Replace the text-only rating header with a horizontal spectrum bar. Five positions: Strong Sell, Sell, Hold, Buy, Strong Buy. A positioned indicator dot/arrow marks the current rating. Color gradient from red (left) to green (right).

The rationale text (1-2 sentences) stays below the gauge.

Mobile: gauge takes full width, labels below each position abbreviated to "SS / S / H / B / SB".

#### 1.2 Key metrics — no change

The 2-col grid of label/value/context is already compact. Keep as-is.

#### 1.3 Bull/Bear/Base collapsible cards

Each case card shows **collapsed by default** with:
- Case name (Bull / Bear / Base) with colored left border (green / red / amber — same as current)
- One-line summary sentence visible in collapsed state

Click/tap to expand the full paragraph text. Only one case can be expanded at a time (accordion-style, clicking another collapses the previous). Chevron icon indicates expand/collapse state.

**AI prompt change**: Add `bullSummary`, `bearSummary`, `baseSummary` fields (one sentence each) to the thesis prompt output. The full `bullCase`/`bearCase`/`baseCase` paragraphs remain unchanged.

File: `lib/ai/thesis.ts` — Add to the JSON schema instruction:
```
"bullSummary": "One sentence capturing the core bull thesis",
"bearSummary": "One sentence capturing the core bear thesis",
"baseSummary": "One sentence capturing the core base case",
```

File: `lib/market/types.ts` — Add to `ThesisResponse`:
```typescript
bullSummary: string;
bearSummary: string;
baseSummary: string;
```

File: `lib/ai/thesis.ts` (`generateThesis`) — Add fallback extraction: if the AI doesn't return summaries, take the first sentence of each case paragraph.

#### 1.4 Verdict bar

A compact horizontal strip below the rating gauge showing a visual breakdown of bull vs bear evidence strength. Rendered as a simple two-tone bar (green portion = bull weight, red portion = bear weight) derived from the rating:
- Strong Buy: 90/10
- Buy: 70/30
- Hold: 50/50
- Sell: 30/70
- Strong Sell: 10/90

This is purely visual — no AI change needed. Derived from the rating string.

#### 1.5 Mobile responsiveness

- Rating gauge: full-width, abbreviated labels
- Metrics grid: 2-col on mobile (already works)
- Case cards: full-width, tap to expand
- All touch targets >= 44px on collapse/expand controls

### Files affected

- `lib/ai/thesis.ts` — prompt adds summary fields, parsing adds fallbacks
- `lib/market/types.ts` — `ThesisResponse` adds 3 summary fields
- `app/watchlist/ticker-detail-panel.tsx` — thesis tab rendering replaced (lines ~1167-1271)

---

## Feature 2: News Tab Theme Buttons

### Current state

The news tab shows a single AI-generated paragraph summarizing all articles with bracket citations, followed by a flat "Sources" list of article links.

### Changes

#### 2.1 Structured AI response

Replace the prose summary with structured themed output.

File: `lib/ai/news-summary.ts` — Rewrite the system prompt and return type:

New system prompt instructs the AI to return JSON:
```json
{
  "themes": [
    {
      "label": "Court Rulings",
      "summary": "Federal court rules social media companies must verify ages.",
      "detail": "The 5th Circuit upheld the Texas age-verification law [1], impacting Meta's under-18 user policies. Analysts estimate $200M compliance cost [3].",
      "articleIndices": [1, 3]
    }
  ]
}
```

Rules for the AI:
- 2-5 themes per ticker (group related articles)
- `label`: 1-3 words, noun phrase (not a sentence)
- `summary`: exactly one sentence, no citations
- `detail`: 2-3 sentences with bracket citations [N]
- `articleIndices`: 1-indexed, matching input article numbers
- Every article must appear in at least one theme

New interface:
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

The function `generateNewsSummary` return type changes from `string | null` to `StructuredNewsSummary | null`.

File: `lib/market/types.ts` — Update `TickerNews`:
```typescript
export interface TickerNews {
  ticker: string;
  articles: NewsArticle[];
  aiSummary: string | null;  // kept for backward compat with old cache entries
  themes: NewsTheme[] | null;  // new structured format
}
```

File: `app/api/market/news/route.ts` — Populate both `aiSummary` (concatenated summaries for fallback) and `themes` from the structured response.

#### 2.2 Theme chips UI

Render themes as a horizontal scrollable row of pill buttons:
- `overflow-x-auto flex flex-nowrap gap-2` container with hidden scrollbar styling
- Each chip: `rounded-full px-3 py-1.5 text-xs font-medium` with border
- Selected chip gets filled background (zinc-900/zinc-100 for dark/light)
- First theme auto-selected on load

Mobile: row scrolls horizontally via touch swipe. No wrapping.
Desktop: wraps if space allows (`md:flex-wrap`).

#### 2.3 Expanded detail panel

Below the chips, show the selected theme's content:
- The `detail` text with rendered bracket citations (reuse existing `renderCitedSummary`)
- Below: filtered article list showing only articles matching `articleIndices`
- "Show all sources" toggle reveals the complete article list

#### 2.4 Fallback rendering

If `themes` is null but `aiSummary` exists (old cached data), render the current paragraph layout unchanged. This ensures no visual regression for cached responses.

#### 2.5 Mobile responsiveness

- Theme chips: horizontal scroll with `-webkit-overflow-scrolling: touch`
- Detail panel: full-width, no padding change needed
- Article list: same as current mobile layout
- All chip touch targets >= 44px height

### Files affected

- `lib/ai/news-summary.ts` — prompt + return type restructured
- `lib/market/types.ts` — `TickerNews` adds `themes` field, new `NewsTheme` interface
- `app/api/market/news/route.ts` — populate both `themes` and `aiSummary`
- `app/watchlist/ticker-detail-panel.tsx` — news tab rendering replaced (lines ~918-996)

---

## Feature 3: Macro Dashboard Visual Overhaul

### Current state

The macro dashboard shows a Market Mood section (already visual — keep as-is), a "Macro Outlook" hero card with a full paragraph, then 5 category sections each with an AI paragraph + article list. Categories are always expanded.

### Changes

#### 3.1 Structured macro outlook

Replace the prose `macroOutlook` paragraph with structured data.

File: `lib/ai/macro-summary.ts` — Change prompt to request:
```json
{
  "categories": [
    {
      "id": "fed",
      "oneLiner": "Fed holds rates, signals September cut unlikely",
      "summary": "The full 4-6 sentence analysis..."
    }
  ],
  "macroOutlook": {
    "sentimentLabel": "Cautious",
    "headline": "Mixed signals as strong jobs data clashes with inverted yield curve",
    "keyDrivers": ["Fed holding rates", "Oil above $85", "Jobs growth cooling"]
  }
}
```

Update `MacroSummaryResult` interface:
```typescript
export interface MacroSummaryResult {
  categories: { id: string; oneLiner: string; summary: string }[];
  macroOutlook: {
    sentimentLabel: "Bullish" | "Cautious" | "Bearish" | "Mixed";
    headline: string;
    keyDrivers: string[];
  };
}
```

Backward compatibility: the `MacroSummaryResult` type changes `macroOutlook` from `string` to the structured object. The API route always returns the new format. Old cached responses (where `macroOutlook` is a string) are handled in the dashboard component: check `typeof data.macroOutlook === "string"` — if true, render as a paragraph (current behavior). New responses render the structured card. Cache entries expire naturally (1hr TTL).

#### 3.2 Compact outlook card

Replace the paragraph hero with:
- Sentiment badge: colored pill showing sentimentLabel (green Bullish / amber Cautious / red Bearish / zinc Mixed)
- Headline: one sentence, `text-base font-medium`
- Key drivers: row of subtle chips (`rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs`)

Mobile: badge + headline stack vertically, driver chips wrap.

#### 3.3 Collapsed category cards

Each category renders as a compact card, **collapsed by default**:
- Category label (left) + article count badge (right)
- `oneLiner` text below the label in muted color
- Click/tap expands to show full summary + article list

Expanded state shows:
- Full AI summary paragraph
- Article list (title + time ago, tighter spacing than current)
- On mobile: hide publisher name to save space

Click again to collapse. Multiple categories can be expanded simultaneously (independent toggles, not accordion — users may want to compare categories).

Layout:
- Mobile: single column, full-width cards
- Desktop: `grid-cols-1 md:grid-cols-2` grid with gap-4

#### 3.4 Market Mood section — no change

The Phase 9 sentiment bar + trending chips + sector grid is already visual and compact.

#### 3.5 Mobile responsiveness

- Outlook card: stacked layout, wrapping chips
- Category cards: full-width single column
- Expand/collapse touch targets >= 44px (entire card header is tappable)
- Article text: `text-sm` on mobile, hide publisher

### Files affected

- `lib/ai/macro-summary.ts` — prompt + interface restructured
- `app/macro/macro-dashboard.tsx` — outlook rendering + category cards replaced
- `app/api/macro/news/route.ts` — may need minor changes to pass through new fields

---

## Cost & Cache Impact

- **No new API calls** — same number of Gemini/Groq calls, just restructured prompts
- **Cache invalidation** — existing cached responses will have old format. Both features handle this with fallback rendering (check for new fields, fall back to old display if missing). Old cache entries expire naturally per their TTLs (1hr macro, 4hr news, 7d thesis).
- **Token usage** — structured JSON output may use ~10-20% more output tokens than prose. Negligible cost impact at current volume.

## Testing Strategy

- Existing tests continue to pass (backward-compatible types)
- New unit tests for AI prompt parsing: verify structured responses parse correctly, verify fallback when summaries are missing
- Type-check: `npx tsc --noEmit` passes
- Manual verification: dev server, check each section on desktop and mobile viewport

## Interview Talking Points

- **Information density vs readability** — visual gauges and collapsible cards deliver the same data in less viewport space while improving scannability
- **Backward-compatible schema evolution** — new fields are optional, old cached data renders with fallback UI, zero-downtime migration as cache expires naturally
- **AI prompt engineering for structured output** — instructing LLMs to return structured JSON with specific field constraints (word limits, array indices) vs free-form prose
- **Mobile-first progressive disclosure** — collapsed-by-default with expand-on-tap reduces cognitive load on small screens
