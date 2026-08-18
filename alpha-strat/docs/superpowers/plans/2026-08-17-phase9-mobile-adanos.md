# Phase 9: Mobile Responsive + Adanos Maximization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AlphaStrat fully usable on mobile, maximize the Adanos free tier via batch endpoints, and ground the thesis AI prompt for accuracy.

**Architecture:** Adaptive responsive layout using Tailwind `md:` breakpoint (768px). Same components render differently per breakpoint — no separate mobile routes. Adanos batch/global endpoints with shared caching (24hr TTL). Thesis prompt rewrite for fact-first accuracy.

**Tech Stack:** Tailwind CSS v4 responsive utilities, existing Recharts, Adanos REST API, existing `getOrFetch<T>()` shared cache.

## Global Constraints

- No new npm dependencies
- All Adanos API calls cached via `getOrFetch` with `{ shared: true }` and `ADANOS_TTL` (24hr)
- Monthly Adanos budget must stay under 250 requests
- Minimum touch target: 44px on mobile
- Minimum body font: 14px on mobile
- All tables wrapped in `overflow-x: auto` containers
- Dark mode must work on all new/modified components
- Tailwind CSS v4 syntax (no `@apply` in components, utility classes only)
- Next.js 16.3 — `cookies()` is async, use `proxy.ts` not middleware

---

### Task 1: Mobile Navigation — Hamburger Menu + Slide-Out Panel

**Files:**
- Modify: `app/components/header.tsx`
- Create: `app/components/mobile-nav.tsx`

**Interfaces:**
- Consumes: `user` object from Supabase `getUser()` (already fetched in `Header`)
- Produces: `<MobileNav user={user} />` client component used by `Header`

- [ ] **Step 1: Create `app/components/mobile-nav.tsx`**

This is a `"use client"` component. It receives `user: { email: string } | null` as a prop.

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  user: { email: string } | null;
}

export function MobileNav({ user }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on navigation
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!user) return null;

  const navLinks = [
    { href: "/watchlist", label: "Watchlist" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/macro", label: "Macro" },
  ];

  return (
    <>
      {/* Hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative z-50 flex h-11 w-11 items-center justify-center rounded-md md:hidden"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        <div className="flex w-5 flex-col gap-1.5">
          <span
            className={`block h-0.5 w-full bg-zinc-900 transition-transform dark:bg-zinc-100 ${
              open ? "translate-y-2 rotate-45" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-full bg-zinc-900 transition-opacity dark:bg-zinc-100 ${
              open ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-0.5 w-full bg-zinc-900 transition-transform dark:bg-zinc-100 ${
              open ? "-translate-y-2 -rotate-45" : ""
            }`}
          />
        </div>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-out panel */}
      <div
        ref={panelRef}
        className={`fixed right-0 top-0 z-40 flex h-full w-64 flex-col bg-white pt-safe-top dark:bg-zinc-950 transition-transform duration-200 md:hidden ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex flex-col gap-1 px-4 pt-16">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-3 py-3 text-base font-medium transition-colors ${
                pathname === link.href
                  ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-900"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-auto border-t border-zinc-200 px-4 py-4 dark:border-zinc-800">
          <p className="truncate text-sm text-zinc-500 dark:text-zinc-400">
            {user.email}
          </p>
          <form action="/auth/logout" method="POST">
            <button
              type="submit"
              className="mt-2 w-full rounded-lg py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              Log out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
```

**Important:** The logout form action needs to use the actual `logout` server action. Since this is a client component, we need to pass the logout action as a prop or use a form action URL. The simplest approach: pass `logoutAction` as a prop from the server component.

Update the component to accept `logoutAction: () => Promise<void>` prop and use it directly on the `<form action={logoutAction}>`.

- [ ] **Step 2: Modify `app/components/header.tsx`**

Split the header into server + client parts. The server component fetches the user and renders a wrapper. On desktop (md+), show the current nav. On mobile (<md), show the hamburger.

```tsx
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { MarketStatus } from "@/app/components/market-status";
import { MobileNav } from "@/app/components/mobile-nav";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-3 md:px-6">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          AlphaStrat
        </Link>

        {/* Desktop nav — hidden on mobile */}
        <nav className="hidden items-center gap-4 md:flex">
          {user ? (
            <>
              <Link href="/watchlist" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Watchlist
              </Link>
              <Link href="/portfolio" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Portfolio
              </Link>
              <Link href="/macro" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Macro
              </Link>
              <MarketStatus />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {user.email}
              </span>
              <form action={logout}>
                <button type="submit" className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200">
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
              Log in
            </Link>
          )}
        </nav>

        {/* Mobile nav — visible only on mobile */}
        <MobileNav
          user={user ? { email: user.email ?? "" } : null}
          logoutAction={logout}
        />
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Add safe-area CSS utility to `app/globals.css`**

Add after the existing styles:

```css
.pt-safe-top {
  padding-top: env(safe-area-inset-top);
}
.pb-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}
```

- [ ] **Step 4: Run `npx tsc --noEmit` to verify no type errors**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/components/header.tsx app/components/mobile-nav.tsx app/globals.css
git commit -m "feat: add responsive hamburger menu with slide-out nav panel"
```

---

### Task 2: Watchlist Card Layout on Mobile

**Files:**
- Modify: `app/watchlist/watchlist-dashboard.tsx`

**Interfaces:**
- Consumes: `quoteByTicker`, `earningsByTicker`, `analystByTicker` maps (existing)
- Produces: Card-based mobile layout alongside existing desktop table

- [ ] **Step 1: Add mobile card layout to the watchlist render**

In `watchlist-dashboard.tsx`, find the `<div className="overflow-x-auto">` that wraps the table (around line 460). Wrap the existing table in `<div className="hidden md:block">`. Before it, add a mobile card list wrapped in `<div className="md:hidden flex flex-col gap-3">`.

Each card renders:

```tsx
<div
  key={item.id}
  className={`rounded-lg border border-zinc-200 p-4 transition-colors dark:border-zinc-800 ${
    isExpanded
      ? "bg-zinc-50 dark:bg-zinc-900/30"
      : "active:bg-zinc-50 dark:active:bg-zinc-900/20"
  }`}
  onClick={() => setExpandedTicker(isExpanded ? null : item.ticker)}
>
  {/* Row 1: Ticker + Price */}
  <div className="flex items-center justify-between">
    <span className="font-mono text-base font-semibold text-zinc-900 dark:text-zinc-100">
      {item.ticker}
    </span>
    <span className="tabular-nums text-base text-zinc-700 dark:text-zinc-300">
      {quote ? `$${quote.price.toFixed(2)}` : "—"}
    </span>
  </div>
  {/* Row 2: Change + Rating */}
  <div className="mt-1.5 flex items-center justify-between">
    <span className={`text-sm tabular-nums ${quote ? changeColor(quote.change) : "text-zinc-500"}`}>
      {quote
        ? `${quote.change >= 0 ? "+" : ""}$${formatUsd(quote.change)} (${quote.changePercent >= 0 ? "+" : ""}${quote.changePercent.toFixed(2)}%)`
        : "—"}
    </span>
    <span className={`text-xs font-medium ${ratingColor(analyst?.recommendationKey)}`}>
      {analyst?.recommendationKey ? formatRating(analyst.recommendationKey) : ""}
    </span>
  </div>
  {/* Row 3: Earnings + Remove */}
  {(earning?.earningsDate || true) && (
    <div className="mt-2 flex items-center justify-between">
      <span className={`text-xs ${upcoming ? "font-medium text-amber-500" : "text-zinc-500 dark:text-zinc-400"}`}>
        {earning?.earningsDate ? `Earnings: ${formatEarningsDate(earning.earningsDate)}` : ""}
      </span>
      <div onClick={(e) => e.stopPropagation()}>
        <DeleteButton id={item.id} />
      </div>
    </div>
  )}
</div>
```

When `isExpanded` is true on mobile, render the `TickerDetailPanel` below the card (not in a bottom sheet yet — that's Task 3).

- [ ] **Step 2: Run `npx tsc --noEmit`**

Expected: 0 errors

- [ ] **Step 3: Commit**

```bash
git add app/watchlist/watchlist-dashboard.tsx
git commit -m "feat: add card-based watchlist layout for mobile screens"
```

---

### Task 3: Bottom Sheet Component + Mobile Detail Panel

**Files:**
- Create: `app/watchlist/bottom-sheet.tsx`
- Modify: `app/watchlist/watchlist-dashboard.tsx`

**Interfaces:**
- Consumes: `open: boolean`, `onClose: () => void`, `title: string`, `children: ReactNode`
- Produces: `<BottomSheet>` generic component, used to wrap `<TickerDetailPanel>` on mobile

- [ ] **Step 1: Create `app/watchlist/bottom-sheet.tsx`**

```tsx
"use client";

import { type ReactNode, useEffect, useRef } from "react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Lock body scroll
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    currentY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    currentY.current = e.touches[0].clientY;
    const delta = currentY.current - startY.current;
    if (delta > 0 && sheetRef.current) {
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  };

  const handleTouchEnd = () => {
    const delta = currentY.current - startY.current;
    if (delta > 100) {
      onClose();
    }
    if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-white pb-safe-bottom dark:bg-zinc-950 transition-transform"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-3">
          <div className="h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-700" />
        </div>
        {/* Title */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 pb-3 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Integrate BottomSheet into watchlist-dashboard.tsx**

In the mobile card layout (Task 2), instead of rendering `TickerDetailPanel` inline below the card, render it inside a `<BottomSheet>`:

```tsx
import { BottomSheet } from "./bottom-sheet";

// At the bottom of the mobile card list, outside the map:
{expandedTicker && (
  <BottomSheet
    open={!!expandedTicker}
    onClose={() => setExpandedTicker(null)}
    title={expandedTicker}
  >
    <TickerDetailPanel
      ticker={expandedTicker}
      quote={quoteByTicker.get(expandedTicker) ?? undefined}
      earning={earningsByTicker.get(expandedTicker) ?? undefined}
      analyst={analystByTicker.get(expandedTicker) ?? undefined}
    />
  </BottomSheet>
)}
```

Remove the inline `TickerDetailPanel` expansion from the mobile cards added in Task 2. Keep the desktop table's inline expansion unchanged.

- [ ] **Step 3: Run `npx tsc --noEmit`**

Expected: 0 errors

- [ ] **Step 4: Commit**

```bash
git add app/watchlist/bottom-sheet.tsx app/watchlist/watchlist-dashboard.tsx
git commit -m "feat: add bottom sheet for mobile ticker detail panel"
```

---

### Task 4: Portfolio + Macro Mobile Responsiveness

**Files:**
- Modify: `app/portfolio/positions-table.tsx`
- Modify: `app/portfolio/portfolio-dashboard.tsx`
- Modify: `app/macro/macro-dashboard.tsx`

**Interfaces:**
- Consumes: existing component props (no changes)
- Produces: responsive layouts for the same components

- [ ] **Step 1: Make positions table responsive**

In `app/portfolio/positions-table.tsx`:

- On columns "Cost Basis" (th+td), "Total Cost" (th+td), "Market Value" (th+td): add `hidden md:table-cell` class.
- This leaves Ticker, Shares, Current Price, P/L ($), P/L (%), and Actions visible on mobile — 6 columns instead of 9.
- Footer `<td>` elements for hidden columns: add `hidden md:table-cell`.
- The `colSpan` for `AddTransactionRow` and `TransactionLog`: change from hardcoded `9` to a responsive value. Simplest: keep `colSpan={9}` (extra columns are hidden via CSS, the span still works).

- [ ] **Step 2: Adjust portfolio dashboard padding**

In `app/portfolio/portfolio-dashboard.tsx`:

- The main wrapper `<div className="flex flex-col gap-8">` — change to `gap-6 md:gap-8`.
- The "Updated Xs ago" area — fine as-is.
- The grid `grid-cols-1 gap-6 lg:grid-cols-2` — already responsive, no changes needed.

- [ ] **Step 3: Make macro dashboard touch-friendly**

In `app/macro/macro-dashboard.tsx`:

- Settings gear button: wrap in a container with `min-h-[44px] min-w-[44px]` and center the icon.
- Article list items (`<li>` elements): add `py-2` padding (currently only has gap from `space-y-2`).
- Section toggle checkboxes in the settings panel: ensure each checkbox row has `min-h-[44px]` for touch.

- [ ] **Step 4: Run `npx tsc --noEmit`**

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add app/portfolio/positions-table.tsx app/portfolio/portfolio-dashboard.tsx app/macro/macro-dashboard.tsx
git commit -m "feat: improve mobile responsiveness for portfolio and macro pages"
```

---

### Task 5: Adanos Batch Compare + Enable All Sources

**Files:**
- Modify: `lib/market/adanos.ts`
- Create: `app/api/market/batch-sentiment/route.ts`

**Interfaces:**
- Consumes: Adanos `/compare` endpoint, `getOrFetch` shared cache
- Produces: `getAdanosCompareSentiment(tickers, source)` → `Map<string, AdanosSentiment>`, new batch API route

- [ ] **Step 1: Add compare function and enable all sources in `lib/market/adanos.ts`**

Add a new exported function after the existing single-ticker functions:

```typescript
export interface AdanosCompareResult {
  ticker: string;
  found: boolean;
  buzzScore: number;
  trend: string;
  mentions: number;
  sentimentScore: number;
  bullishPct: number;
  bearishPct: number;
}

const SOURCE_PATHS: Record<string, string> = {
  reddit: "/reddit/stocks/v1/compare",
  twitter: "/x/stocks/v1/compare",
  news: "/news/stocks/v1/compare",
  polymarket: "/polymarket/stocks/v1/compare",
};

export async function getAdanosCompareSentiment(
  tickers: string[],
  source: "reddit" | "twitter" | "news" | "polymarket"
): Promise<Map<string, AdanosCompareResult>> {
  const path = SOURCE_PATHS[source];
  if (!path) return new Map();

  const encoded = tickers.map((t) => encodeURIComponent(t)).join(",");
  const data = await adanosFetch(`${path}?tickers=${encoded}`);
  if (!data) return new Map();

  const results = new Map<string, AdanosCompareResult>();
  const items = Array.isArray(data) ? data : (data.results as Record<string, unknown>[]) ?? [];

  for (const item of items) {
    const ticker = item.ticker as string;
    if (!ticker) continue;
    results.set(ticker, {
      ticker,
      found: (item.found as boolean) ?? true,
      buzzScore: (item.buzz_score as number) ?? 0,
      trend: (item.trend as string) ?? "unknown",
      mentions: (item.mentions as number) ?? 0,
      sentimentScore: (item.sentiment_score as number) ?? 0,
      bullishPct: (item.bullish_pct as number) ?? 0,
      bearishPct: (item.bearish_pct as number) ?? 0,
    });
  }

  return results;
}
```

Also update `getAvailableSources()`:

```typescript
export function getAvailableSources(): string[] {
  const raw = process.env.ADANOS_API_KEY;
  if (!raw) return [];
  return ["reddit", "twitter", "news", "polymarket"];
}
```

- [ ] **Step 2: Create batch sentiment API route**

Create `app/api/market/batch-sentiment/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import { getAdanosCompareSentiment, getAvailableSources, type AdanosCompareResult } from "@/lib/market/adanos";
import { ADANOS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";

interface BatchSentimentResponse {
  sources: Record<string, Map<string, AdanosCompareResult> | null>;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tickersParam = searchParams.get("tickers")?.trim().toUpperCase();

  if (!tickersParam) {
    return NextResponse.json({ error: "Missing required query param: tickers" }, { status: 400 });
  }

  const tickers = tickersParam.split(",").filter(Boolean).slice(0, 10);

  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sortedKey = [...tickers].sort().join(",");
    const availableSources = getAvailableSources();

    const { data } = await getOrFetch(
      supabase,
      `batch-sentiment:${sortedKey}`,
      "batch-sentiment",
      ADANOS_TTL,
      async () => {
        const results: Record<string, Record<string, AdanosCompareResult>> = {};

        const sourceResults = await Promise.all(
          availableSources.map(async (source) => {
            const map = await getAdanosCompareSentiment(
              tickers,
              source as "reddit" | "twitter" | "news" | "polymarket"
            );
            return { source, data: Object.fromEntries(map) };
          })
        );

        for (const { source, data } of sourceResults) {
          results[source] = data;
        }

        return { tickers, sources: results };
      },
      {
        shouldCache: (result) =>
          Object.values(result.sources).some((s) => Object.keys(s).length > 0),
        shared: true,
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch batch sentiment: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Write test for compare function**

Create `lib/market/__tests__/adanos-compare.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch before importing the module
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("getAdanosCompareSentiment", () => {
  beforeEach(() => {
    vi.resetModules();
    mockFetch.mockReset();
    process.env.ADANOS_API_KEY = "test-key";
  });

  it("returns a map of compare results for multiple tickers", async () => {
    const { getAdanosCompareSentiment } = await import("../adanos");

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { ticker: "AAPL", found: true, buzz_score: 5.2, trend: "bullish", mentions: 120, sentiment_score: 0.7, bullish_pct: 65, bearish_pct: 35 },
        { ticker: "MSFT", found: true, buzz_score: 3.1, trend: "neutral", mentions: 80, sentiment_score: 0.5, bullish_pct: 50, bearish_pct: 50 },
      ],
    });

    const result = await getAdanosCompareSentiment(["AAPL", "MSFT"], "reddit");
    expect(result.size).toBe(2);
    expect(result.get("AAPL")?.buzzScore).toBe(5.2);
    expect(result.get("MSFT")?.trend).toBe("neutral");
  });

  it("returns empty map when API fails", async () => {
    const { getAdanosCompareSentiment } = await import("../adanos");

    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, statusText: "Internal Server Error" });

    const result = await getAdanosCompareSentiment(["AAPL"], "reddit");
    expect(result.size).toBe(0);
  });

  it("returns empty map when no API key", async () => {
    delete process.env.ADANOS_API_KEY;
    const { getAdanosCompareSentiment } = await import("../adanos");

    const result = await getAdanosCompareSentiment(["AAPL"], "reddit");
    expect(result.size).toBe(0);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run lib/market/__tests__/adanos-compare.test.ts`
Expected: 3 tests pass

- [ ] **Step 5: Run `npx tsc --noEmit`**

Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
git add lib/market/adanos.ts app/api/market/batch-sentiment/route.ts lib/market/__tests__/adanos-compare.test.ts
git commit -m "feat: add Adanos batch compare endpoint and enable all 4 sources"
```

---

### Task 6: Adanos Trending + Market Sentiment for Macro Dashboard

**Files:**
- Modify: `lib/market/adanos.ts`
- Create: `app/api/macro/market-mood/route.ts`
- Modify: `app/macro/macro-dashboard.tsx`

**Interfaces:**
- Consumes: Adanos `/trending`, `/market-sentiment`, `/trending/sectors` endpoints
- Produces: `getAdanosTrending()`, `getAdanosMarketSentiment()`, `getAdanosSectorTrending()`, new API route, "Market Mood" UI section

- [ ] **Step 1: Add trending/market-sentiment functions to `lib/market/adanos.ts`**

```typescript
export interface AdanosTrendingTicker {
  ticker: string;
  mentions: number;
  buzzScore: number;
  sentimentScore: number;
  trend: string;
}

export interface AdanosMarketSentiment {
  overallScore: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  totalMentions: number;
  tickerCount: number;
}

export interface AdanosSectorSentiment {
  sector: string;
  sentimentScore: number;
  buzzScore: number;
  mentions: number;
  trend: string;
}

export async function getAdanosTrending(): Promise<AdanosTrendingTicker[]> {
  const data = await adanosFetch("/reddit/stocks/v1/trending");
  if (!data) return [];

  const items = Array.isArray(data) ? data : (data.trending as Record<string, unknown>[]) ?? [];
  return items.slice(0, 10).map((t) => ({
    ticker: (t.ticker as string) ?? "",
    mentions: (t.mentions as number) ?? 0,
    buzzScore: (t.buzz_score as number) ?? 0,
    sentimentScore: (t.sentiment_score as number) ?? 0,
    trend: (t.trend as string) ?? "unknown",
  }));
}

export async function getAdanosMarketSentiment(): Promise<AdanosMarketSentiment | null> {
  const data = await adanosFetch("/reddit/stocks/v1/market-sentiment");
  if (!data) return null;

  return {
    overallScore: (data.overall_score as number) ?? (data.sentiment_score as number) ?? 0,
    bullishPct: (data.bullish_pct as number) ?? 0,
    bearishPct: (data.bearish_pct as number) ?? 0,
    neutralPct: (data.neutral_pct as number) ?? 100 - ((data.bullish_pct as number) ?? 0) - ((data.bearish_pct as number) ?? 0),
    totalMentions: (data.total_mentions as number) ?? 0,
    tickerCount: (data.ticker_count as number) ?? 0,
  };
}

export async function getAdanosSectorTrending(): Promise<AdanosSectorSentiment[]> {
  const data = await adanosFetch("/reddit/stocks/v1/trending/sectors");
  if (!data) return [];

  const items = Array.isArray(data) ? data : (data.sectors as Record<string, unknown>[]) ?? [];
  return items.map((s) => ({
    sector: (s.sector as string) ?? (s.name as string) ?? "",
    sentimentScore: (s.sentiment_score as number) ?? 0,
    buzzScore: (s.buzz_score as number) ?? 0,
    mentions: (s.mentions as number) ?? 0,
    trend: (s.trend as string) ?? "unknown",
  }));
}
```

- [ ] **Step 2: Create market-mood API route**

Create `app/api/macro/market-mood/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getOrFetch } from "@/lib/cache";
import {
  getAdanosTrending,
  getAdanosMarketSentiment,
  getAdanosSectorTrending,
  type AdanosTrendingTicker,
  type AdanosMarketSentiment,
  type AdanosSectorSentiment,
} from "@/lib/market/adanos";
import { ADANOS_TTL } from "@/lib/cache/freshness";
import { createClient } from "@/lib/supabase/server";

interface MarketMoodResponse {
  trending: AdanosTrendingTicker[];
  marketSentiment: AdanosMarketSentiment | null;
  sectors: AdanosSectorSentiment[];
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } = await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data } = await getOrFetch<MarketMoodResponse>(
      supabase,
      "macro:market-mood",
      "market-mood",
      ADANOS_TTL,
      async () => {
        const [trending, marketSentiment, sectors] = await Promise.all([
          getAdanosTrending(),
          getAdanosMarketSentiment(),
          getAdanosSectorTrending(),
        ]);
        return { trending, marketSentiment, sectors };
      },
      {
        shouldCache: (result) =>
          !!(result.trending.length > 0 || result.marketSentiment || result.sectors.length > 0),
        shared: true,
      }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch market mood: ${err instanceof Error ? err.message : String(err)}` },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Add Market Mood section to macro dashboard**

In `app/macro/macro-dashboard.tsx`:

Add interfaces at the top:

```typescript
interface TrendingTicker {
  ticker: string;
  mentions: number;
  buzzScore: number;
  sentimentScore: number;
  trend: string;
}

interface MarketSentimentData {
  overallScore: number;
  bullishPct: number;
  bearishPct: number;
  neutralPct: number;
  totalMentions: number;
  tickerCount: number;
}

interface SectorSentiment {
  sector: string;
  sentimentScore: number;
  buzzScore: number;
  mentions: number;
  trend: string;
}

interface MarketMoodData {
  trending: TrendingTicker[];
  marketSentiment: MarketSentimentData | null;
  sectors: SectorSentiment[];
}
```

Add state + fetch effect in the `MacroDashboard` component:

```typescript
const [marketMood, setMarketMood] = useState<MarketMoodData | null>(null);

useEffect(() => {
  let cancelled = false;
  fetch("/api/macro/market-mood")
    .then(async (res) => {
      if (!res.ok) return;
      return res.json() as Promise<MarketMoodData>;
    })
    .then((data) => {
      if (!cancelled && data) setMarketMood(data);
    })
    .catch(() => {});
  return () => { cancelled = true; };
}, []);
```

Add a `MarketMoodSection` component that renders above the RSS categories:

```tsx
function MarketMoodSection({ data }: { data: MarketMoodData }) {
  const sentiment = data.marketSentiment;

  return (
    <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
        Social Market Mood
      </h3>

      {/* Sentiment bar */}
      {sentiment && (
        <div className="mt-3">
          <div className="flex h-3 overflow-hidden rounded-full">
            <div
              className="bg-emerald-500"
              style={{ width: `${sentiment.bullishPct}%` }}
            />
            <div
              className="bg-zinc-300 dark:bg-zinc-600"
              style={{ width: `${sentiment.neutralPct}%` }}
            />
            <div
              className="bg-red-500"
              style={{ width: `${sentiment.bearishPct}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-zinc-500 dark:text-zinc-400">
            <span className="text-emerald-600 dark:text-emerald-400">
              {sentiment.bullishPct.toFixed(0)}% Bullish
            </span>
            <span>
              {sentiment.totalMentions.toLocaleString()} mentions across {sentiment.tickerCount} tickers
            </span>
            <span className="text-red-600 dark:text-red-400">
              {sentiment.bearishPct.toFixed(0)}% Bearish
            </span>
          </div>
        </div>
      )}

      {/* Trending tickers */}
      {data.trending.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Trending on Social Media
          </h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.trending.slice(0, 8).map((t) => (
              <span
                key={t.ticker}
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  t.sentimentScore > 0.6
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    : t.sentimentScore < 0.4
                    ? "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {t.ticker}
                <span className="text-[10px] opacity-70">
                  {t.mentions}
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Sector sentiment */}
      {data.sectors.length > 0 && (
        <div className="mt-4">
          <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Sector Sentiment
          </h4>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">
            {data.sectors.map((s) => (
              <div
                key={s.sector}
                className="rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100">
                  {s.sector}
                </span>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span
                    className={`text-xs font-medium ${
                      s.sentimentScore > 0.6
                        ? "text-emerald-600 dark:text-emerald-400"
                        : s.sentimentScore < 0.4
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    {(s.sentimentScore * 100).toFixed(0)}
                  </span>
                  <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                    {s.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

Render it above the outlook skeleton / category sections:

```tsx
{marketMood && <MarketMoodSection data={marketMood} />}
```

- [ ] **Step 4: Run `npx tsc --noEmit`**

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add lib/market/adanos.ts app/api/macro/market-mood/route.ts app/macro/macro-dashboard.tsx
git commit -m "feat: add social market mood section to macro dashboard via Adanos"
```

---

### Task 7: Adanos Explain + Budget Tracking

**Files:**
- Modify: `lib/market/adanos.ts`
- Modify: `app/api/market/reddit-sentiment/route.ts`
- Modify: `app/watchlist/ticker-detail-panel.tsx`

**Interfaces:**
- Consumes: Adanos `/stock/{ticker}/explain` endpoint
- Produces: `getAdanosExplain(ticker)`, explain data in sentiment response, UI card in sentiment tab

- [ ] **Step 1: Add explain function to `lib/market/adanos.ts`**

```typescript
export interface AdanosExplanation {
  ticker: string;
  explanation: string;
  generatedAt: string;
}

export async function getAdanosExplain(
  ticker: string
): Promise<AdanosExplanation | null> {
  const data = await adanosFetch(`/reddit/stocks/v1/stock/${encodeURIComponent(ticker)}/explain`);
  if (!data) return null;

  return {
    ticker: (data.ticker as string) ?? ticker,
    explanation: (data.explanation as string) ?? (data.summary as string) ?? "",
    generatedAt: (data.generated_at as string) ?? new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Include explain data in reddit-sentiment route**

In `app/api/market/reddit-sentiment/route.ts`:

Import `getAdanosExplain` and `AdanosExplanation`. Add `explain: AdanosExplanation | null` to the `SocialSentimentResponse` interface.

In the `Promise.all` call inside the fetcher, add `getAdanosExplain(ticker)` as a 6th parallel call. Assign the result to the response object.

```typescript
const [reddit, twitter, news, polymarket, analyst, explain] = await Promise.all([
  sources.includes("reddit") ? getAdanosRedditSentiment(ticker) : Promise.resolve(null),
  sources.includes("twitter") ? getAdanosTwitterSentiment(ticker) : Promise.resolve(null),
  sources.includes("news") ? getAdanosNewsSentiment(ticker) : Promise.resolve(null),
  sources.includes("polymarket") ? getAdanosPolymarketSentiment(ticker) : Promise.resolve(null),
  getAnalystData(ticker),
  getAdanosExplain(ticker),
]);

// ... existing comparison generation ...

return { ticker, reddit, twitter, news, polymarket, comparison, explain };
```

- [ ] **Step 3: Show explanation card in ticker-detail-panel.tsx sentiment tab**

In `app/watchlist/ticker-detail-panel.tsx`:

Add `explain` to the `SocialSentimentData` interface:

```typescript
interface SocialSentimentData {
  ticker: string;
  reddit: AdanosSource | null;
  twitter: AdanosSource | null;
  news: AdanosSource | null;
  polymarket: AdanosSource | null;
  comparison: string | null;
  explain: { ticker: string; explanation: string; generatedAt: string } | null;
}
```

In the sentiment tab rendering, after the existing comparison section, add:

```tsx
{sentimentData.explain?.explanation && (
  <div className="mt-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
    <h4 className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
      AI Trend Explanation
    </h4>
    <p className="mt-2 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
      {sentimentData.explain.explanation}
    </p>
    <p className="mt-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
      Generated by Llama 3.1 via Adanos
    </p>
  </div>
)}
```

- [ ] **Step 4: Run `npx tsc --noEmit`**

Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add lib/market/adanos.ts app/api/market/reddit-sentiment/route.ts app/watchlist/ticker-detail-panel.tsx
git commit -m "feat: add AI trend explanation from Adanos to sentiment tab"
```

---

### Task 8: Ground the Thesis AI Prompt

**Files:**
- Modify: `lib/ai/thesis.ts`

**Interfaces:**
- Consumes: same `TickerFundamentals` data
- Produces: same `ThesisResponse` JSON format, but with grounded content

- [ ] **Step 1: Rewrite `THESIS_SYSTEM_PROMPT` in `lib/ai/thesis.ts`**

Replace the existing `THESIS_SYSTEM_PROMPT` string with:

```typescript
const THESIS_SYSTEM_PROMPT = `You interpret company fundamentals data and produce an investment thesis. Your job is to describe what the numbers show — not to sound like a Wall Street analyst. Accuracy matters more than confidence.

Rules:
- Lead with the data, then interpret. Every claim must cite a specific number from the input.
- Use explicit thresholds for context:
  - P/E < 15: cheap relative to S&P median ~22x
  - P/E 15-25: fairly valued
  - P/E > 30: premium valuation, requires above-average growth to justify
  - Revenue growth > 15%: above-average
  - Revenue growth 5-15%: moderate
  - Revenue growth < 5%: slow
  - Debt/equity > 1.5: leveraged
  - Net margin > 20%: high profitability
  - FCF yield > 5%: strong cash generation
- Do not claim "competitive moat" or "market dominance" unless operating margins have been stable or growing over 3+ years AND margins are above the sector median.
- Do not predict specific price targets or percentage returns. State what the valuation implies, not what the stock "will" do.
- If a metric is N/A or missing, say so — do not fill gaps with assumptions.
- Each case (bull, bear, base) must be 4-6 sentences. Every sentence must reference a specific number or ratio.
- The investment rating must be derived from the balance of bull vs bear evidence. If evidence is roughly even, "Hold" is the correct rating, not a guess.
- If the data is insufficient for a confident assessment (multiple key metrics missing), set rating to "Insufficient Data".
- For keyMetrics, select the 6-8 most relevant metrics for THIS company. Context must compare to a benchmark ("vs sector median 22x", "vs 15% last year").
- If a bull or bear case rests on forward-looking assumptions (market expansion, new product), flag it as speculative rather than stating it as fact.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "rating": "Strong Buy" | "Buy" | "Hold" | "Sell" | "Strong Sell" | "Insufficient Data",
  "ratingRationale": "1-2 sentences citing the key numbers that drive this rating",
  "bullCase": "4-6 sentences, each citing specific data",
  "bearCase": "4-6 sentences, each citing specific data",
  "baseCase": "4-6 sentences, each citing specific data",
  "keyMetrics": [
    { "label": "metric name", "value": "formatted value", "context": "comparison to benchmark" }
  ]
}`;
```

- [ ] **Step 2: Run existing tests**

Run: `npx vitest run`
Expected: All tests pass (this is a prompt-only change, no logic changes)

- [ ] **Step 3: Commit**

```bash
git add lib/ai/thesis.ts
git commit -m "refactor: ground thesis AI prompt for accuracy over confidence"
```

---

### Task 9: Update DECISIONS.md + CLAUDE.md

**Files:**
- Modify: `DECISIONS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: all changes from Tasks 1-8
- Produces: updated documentation

- [ ] **Step 1: Add Decision 57 to DECISIONS.md**

Add to the end of DECISIONS.md:

```markdown
## Decision 57 — Phase 9: Mobile Responsive + Adanos Maximization (2026-08-17)

**Context:** AlphaStrat was desktop-only. The header overflowed on mobile, the watchlist's 8-column table was unusable on phones, and the Adanos free tier (250 req/month) was underutilized — using single-ticker endpoints when batch `/compare` was available.

**Mobile approach — Adaptive layout vs separate mobile routes:**
- Chose Tailwind responsive breakpoints (`md:` at 768px) over separate `/m/` routes.
- Same components render differently per breakpoint — no code duplication.
- Key patterns: hamburger slide-out nav, card layout for watchlist, bottom sheet for ticker detail.
- Trade-off: More Tailwind classes per component, but zero route duplication.

**Adanos maximization — Batch-first strategy:**
- `/compare` endpoint batches up to 10 tickers per source in one call (4 calls vs 4N).
- Enabled all 4 sources (reddit, twitter, news, polymarket) — were implemented but hardcoded off.
- Added `/trending`, `/market-sentiment`, `/trending/sectors` to macro dashboard as "Market Mood" section.
- Added `/stock/{ticker}/explain` for free AI trend explanations (Llama 3.1).
- Monthly budget estimate: ~218/250 calls with 24hr shared cache on everything.

**Thesis prompt grounding:**
- Same treatment as options prompt (Decision 56): replaced "write with conviction, no hedging" with fact-first, threshold-based instructions.
- Added explicit comparison benchmarks (P/E vs S&P median, growth rate categories).
- Added "Insufficient Data" rating option when key metrics are missing.

**Interview talking points:**
- Responsive design without code duplication — one codebase, adaptive rendering
- API budget optimization — 8x reduction via batch endpoints
- Touch gesture handling — swipe-to-dismiss bottom sheet with momentum detection
- AI prompt engineering — grounding LLM output in verifiable data thresholds
```

- [ ] **Step 2: Update CLAUDE.md key files section**

Add these entries to the Key Files section:

```markdown
- `app/components/mobile-nav.tsx` — hamburger menu + slide-out panel (client component)
- `app/watchlist/bottom-sheet.tsx` — swipe-to-dismiss bottom sheet for mobile detail panel
- `app/api/market/batch-sentiment/route.ts` — Adanos batch compare API (shared cache, 24hr TTL)
- `app/api/macro/market-mood/route.ts` — Adanos trending + market sentiment + sectors (shared cache, 24hr TTL)
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run build check**

Run: `npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add DECISIONS.md CLAUDE.md
git commit -m "docs: add Decision 57 (Phase 9) and update CLAUDE.md key files"
```
