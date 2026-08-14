# Macro News Dashboard — Design Spec

## Overview

A dedicated `/macro` page that aggregates macro-economic news from free RSS feeds across 5 categories, generates per-category AI summaries and a cross-category macro outlook using Gemini Flash Lite, and caches everything for 1 hour.

## Data Sources

| Category | ID | RSS Feed | Notes |
|---|---|---|---|
| Federal Reserve | `fed` | `https://www.federalreserve.gov/feeds/press_all.xml` | Official Fed press releases |
| Geopolitics | `geopolitics` | `https://feeds.reuters.com/Reuters/worldNews` | Reuters world news |
| Commodities | `commodities` | `https://feeds.reuters.com/reuters/businessNews` | Filtered by commodity keywords (crude, oil, gold, silver, wheat, corn, copper, metals, commodity) |
| Jobs / Economic Data | `jobs` | `https://www.bls.gov/feed/bls_latest.rss` | Bureau of Labor Statistics |
| US Government | `government` | `https://www.whitehouse.gov/feed/` + `https://home.treasury.gov/system/files/136/Treasury-RSS.xml` | Executive orders, Treasury announcements |

All feeds parsed with `rss-parser`. Articles older than 48 hours discarded before AI processing.

## Architecture

**Approach:** Single API route, all categories fetched together (Approach A from brainstorming).

### API Route

`GET /api/macro/news`

1. Auth via `getClaims()`
2. `getOrFetch` with cache key `macro-news`, TTL 1 hour
3. Fetcher: `Promise.allSettled` across all RSS feeds
4. Filter articles to last 48 hours, group by category
5. Single Gemini Flash Lite call for all summaries + macro outlook
6. Return structured response

### Response Shape

```typescript
interface MacroCategory {
  id: string;
  label: string;
  summary: string;
  articles: {
    title: string;
    link: string;
    pubDate: string;
    source: string;
  }[];
}

interface MacroNewsResponse {
  categories: MacroCategory[];
  macroOutlook: string;
  generatedAt: string;
}
```

### Cache

- Cache key: `macro-news`
- TTL: `MACRO_TTL = 3600` (1 hour)
- Uses `getOrFetch<T>()` with per-user cache (composite `user_id, cache_key` constraint)
- `shouldCache`: returns true if at least one category has articles

## File Structure

| File | Purpose |
|---|---|
| `lib/market/rss.ts` | RSS fetcher: fetch & parse feeds, filter to 48hr window, group by category |
| `lib/ai/macro-summary.ts` | Prompt builder + Gemini call for per-category summaries + macro outlook |
| `lib/cache/freshness.ts` | Add `MACRO_TTL = 3600` |
| `app/api/macro/news/route.ts` | API route: orchestrates RSS fetch, cache, AI summary |
| `app/macro/page.tsx` | Server component: auth check, initial data fetch |
| `app/macro/macro-dashboard.tsx` | Client component: renders outlook, category sections, headlines |

## AI Processing

**Provider:** Gemini Flash Lite (same as existing news summaries and thesis generation).

**Prompt strategy:** One call with all headlines grouped by category. The prompt requests:
1. Per-category summary (2-3 sentences each)
2. Cross-category macro outlook (3-4 sentences connecting themes)

**Output format:** JSON response parsed from the Gemini output.

**Token cost:** ~500 input tokens (headlines) + ~400 output tokens per call. At 1hr cache TTL, roughly 24 calls/day maximum.

## UI Design

### Layout

- **Top:** "Macro Outlook" hero card with the cross-category synthesis. Subtle gradient border, larger text. This is the headline takeaway.
- **Below:** Category sections, each collapsible, containing:
  - AI summary in a muted card
  - List of recent headlines: title (clickable link), source badge, relative timestamp
  - Category-colored accent (left border or badge)
- **Footer area:** "Last updated X minutes ago" with relative timestamp

### Category Colors

| Category | Color | Tailwind |
|---|---|---|
| Fed | Purple | `violet-500` / `violet-400` |
| Geopolitics | Rose | `rose-500` / `rose-400` |
| Commodities | Amber | `amber-500` / `amber-400` |
| Jobs | Green | `emerald-500` / `emerald-400` |
| Government | Blue | `blue-500` / `blue-400` |

### Navigation

Add "Macro" link to the sidebar/header navigation alongside Portfolio and Watchlist.

### States

- **Loading:** Skeleton cards matching the final layout
- **Error:** Inline error message per failed category (not a full page error)
- **Empty category:** "No recent articles" message, section still visible
- **All empty:** Macro outlook card shows "Insufficient data for analysis" instead of AI-generated text

## Reused Patterns

- `getOrFetch<T>()` cache utility from `lib/cache/index.ts`
- `generateCompletion()` AI client from `lib/ai/client.ts`
- `getClaims()` auth from `lib/supabase/server.ts`
- Server component + client dashboard pattern from watchlist
- Tailwind component styling consistent with existing cards

## Dependencies

- `rss-parser` — already installed (used by `lib/market/reddit.ts`)
- No new packages required
