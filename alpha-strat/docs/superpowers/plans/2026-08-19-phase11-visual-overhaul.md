# Phase 11: Full Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform AlphaStrat from a functional prototype into a polished financial product with a design token system, purposeful animations, shared components, and consistent visual treatment.

**Architecture:** Centralized CSS custom properties in `globals.css` exposed via Tailwind `@theme inline`. Shared UI components in `app/components/ui/`. Ticker detail panel refactored from 1400+ lines into per-tab files. All animations respect `prefers-reduced-motion`.

**Tech Stack:** Next.js 16.3, React 19, Tailwind CSS v4, Geist/Geist Mono fonts (already loaded), Recharts (already installed)

## Global Constraints

- No new npm dependencies — use only what's installed
- No backend/API/database changes — pure frontend
- All colors must use design tokens, not hardcoded `zinc-*`, `blue-*`, `green-*`, `red-*`
- All animations must be disabled under `@media (prefers-reduced-motion: reduce)`
- Tailwind v4 uses `@theme inline` for custom values, not `tailwind.config.js`
- `cookies()` is async in Next.js 16
- Header component (`app/components/header.tsx`) is an async server component — cannot use `usePathname()` directly; active route detection must be handled by a client wrapper or by the existing `MobileNav` pattern
- Existing test suite must pass after every task (`npx vitest`)
- Use `model: "sonnet"` for subagent dispatches (per CLAUDE.md)

---

### Task 1: Design Tokens + Animation System in globals.css

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Nothing
- Produces: CSS custom properties available as Tailwind classes via `@theme inline`:
  - Colors: `bg-surface-primary`, `bg-surface-secondary`, `bg-surface-tertiary`, `border-border-primary`, `border-border-secondary`, `text-text-primary`, `text-text-secondary`, `text-text-tertiary`, `bg-accent`, `text-accent`, `bg-accent-muted`, `text-success`, `text-danger`, `text-warning`, `bg-success`, `bg-danger`, `bg-warning`
  - Animation classes: `.animate-shimmer`, `.animate-fade-in`, `.animate-slide-up`
  - Transition utilities: `.transition-colors-fast`, `.transition-transform-fast`, `.expand-collapse`

- [ ] **Step 1: Replace globals.css with the complete token system**

Replace the entire contents of `app/globals.css` with:

```css
@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #09090b;
  --surface-primary: #ffffff;
  --surface-secondary: #f8f8fa;
  --surface-tertiary: #f0f0f3;
  --border-primary: #e4e4e7;
  --border-secondary: #d4d4d8;
  --text-primary: #09090b;
  --text-secondary: #52525b;
  --text-tertiary: #71717a;
  --accent: #2563eb;
  --accent-muted: #dbeafe;
  --success: #16a34a;
  --danger: #dc2626;
  --warning: #d97706;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: #0f0f11;
    --foreground: #fafafa;
    --surface-primary: #0f0f11;
    --surface-secondary: #18181b;
    --surface-tertiary: #222225;
    --border-primary: #2a2a2e;
    --border-secondary: #3a3a3e;
    --text-primary: #fafafa;
    --text-secondary: #a1a1aa;
    --text-tertiary: #71717a;
    --accent: #3b82f6;
    --accent-muted: #1e3a5f;
    --success: #22c55e;
    --danger: #ef4444;
    --warning: #f59e0b;
  }
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface-primary: var(--surface-primary);
  --color-surface-secondary: var(--surface-secondary);
  --color-surface-tertiary: var(--surface-tertiary);
  --color-border-primary: var(--border-primary);
  --color-border-secondary: var(--border-secondary);
  --color-text-primary: var(--text-primary);
  --color-text-secondary: var(--text-secondary);
  --color-text-tertiary: var(--text-tertiary);
  --color-accent: var(--accent);
  --color-accent-muted: var(--accent-muted);
  --color-success: var(--success);
  --color-danger: var(--danger);
  --color-warning: var(--warning);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

body {
  background: var(--background);
  color: var(--foreground);
  font-family: var(--font-geist-sans), system-ui, sans-serif;
}

/* Safe area padding for mobile notches */
.pt-safe-top {
  padding-top: env(safe-area-inset-top);
}
.pb-safe-bottom {
  padding-bottom: env(safe-area-inset-bottom);
}

/* Hide scrollbar utility */
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* ── Animations ── */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

@keyframes fade-in {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-shimmer {
  background: linear-gradient(90deg, var(--surface-secondary) 25%, var(--surface-tertiary) 50%, var(--surface-secondary) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.animate-fade-in {
  animation: fade-in 200ms ease-out both;
}

.animate-slide-up {
  animation: slide-up 300ms ease-out both;
}

/* ── Transition utilities ── */
.transition-colors-fast {
  transition: color 120ms, background-color 120ms, border-color 120ms;
}

.transition-transform-fast {
  transition: transform 80ms ease-out;
}

.expand-collapse {
  transition: grid-template-rows 200ms ease-out;
}

/* ── Reduced motion ── */
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer,
  .animate-fade-in,
  .animate-slide-up {
    animation: none;
  }
  .transition-colors-fast,
  .transition-transform-fast,
  .expand-collapse {
    transition: none;
  }
}
```

- [ ] **Step 2: Verify the dev server starts without errors**

Run: `npm run dev`

Open the app in browser. Verify the page renders with the correct background color (white in light mode, `#0f0f11` in dark mode). The app should look the same as before since existing components still use `zinc-*` classes — this step only adds the token infrastructure.

- [ ] **Step 3: Run existing tests**

Run: `npx vitest`

Expected: All existing tests pass (no logic changes).

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(tokens): add design token system and animation utilities to globals.css"
```

---

### Task 2: Shared UI Components (Card, Badge, Skeleton, TabBar, EmptyState, DataRow, SectionHeader)

**Files:**
- Create: `app/components/ui/card.tsx`
- Create: `app/components/ui/badge.tsx`
- Create: `app/components/ui/skeleton.tsx`
- Create: `app/components/ui/tab-bar.tsx`
- Create: `app/components/ui/empty-state.tsx`
- Create: `app/components/ui/data-row.tsx`
- Create: `app/components/ui/section-header.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 1 (Tailwind classes like `bg-surface-secondary`, `border-border-primary`, `text-text-primary`, etc.)
- Produces: React components used by Tasks 3-7:
  - `Card`: `({ children, className?, hover? }) => JSX.Element`
  - `Badge`: `({ variant, children, size? }) => JSX.Element` where variant is `"bullish" | "bearish" | "neutral" | "mixed" | "info"`
  - `Skeleton`: `({ className? }) => JSX.Element`
  - `TabBar`: `({ tabs, activeTab, onChange }) => JSX.Element` where tabs is `{ key: string; label: string }[]`
  - `EmptyState`: `({ icon?, title, description?, action? }) => JSX.Element`
  - `DataRow`: `({ label, value, mono?, trend? }) => JSX.Element`
  - `SectionHeader`: `({ title, action?, description? }) => JSX.Element`

- [ ] **Step 1: Create Card component**

Create `app/components/ui/card.tsx`:

```tsx
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border-primary bg-surface-secondary p-4 md:p-5 ${
        hover
          ? "transition-all duration-150 hover:-translate-y-px hover:border-border-secondary"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Create Badge component**

Create `app/components/ui/badge.tsx`:

```tsx
import type { ReactNode } from "react";

type BadgeVariant = "bullish" | "bearish" | "neutral" | "mixed" | "info";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  bullish: "bg-success/15 text-success",
  bearish: "bg-danger/15 text-danger",
  neutral: "bg-surface-tertiary text-text-secondary",
  mixed: "bg-warning/15 text-warning",
  info: "bg-accent-muted text-accent",
};

export function Badge({ variant, children, size = "sm" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${VARIANT_STYLES[variant]} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Create Skeleton component**

Create `app/components/ui/skeleton.tsx`:

```tsx
interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return <div className={`animate-shimmer rounded ${className}`} />;
}
```

- [ ] **Step 4: Create TabBar component**

Create `app/components/ui/tab-bar.tsx`:

```tsx
"use client";

import { useRef, useEffect, useState } from "react";

interface Tab {
  key: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onChange: (key: string) => void;
}

export function TabBar({ tabs, activeTab, onChange }: TabBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const activeIndex = tabs.findIndex((t) => t.key === activeTab);
    const buttons = container.querySelectorAll<HTMLButtonElement>("button");
    const btn = buttons[activeIndex];
    if (btn) {
      setIndicator({
        left: btn.offsetLeft,
        width: btn.offsetWidth,
      });
    }
  }, [activeTab, tabs]);

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex gap-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={`relative z-10 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div
        className="absolute bottom-0 h-0.5 rounded-full bg-accent transition-all duration-200"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  );
}
```

- [ ] **Step 5: Create EmptyState component**

Create `app/components/ui/empty-state.tsx`:

```tsx
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      {icon && <div className="mb-3 text-text-tertiary">{icon}</div>}
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90 active:scale-[0.98]"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Create DataRow component**

Create `app/components/ui/data-row.tsx`:

```tsx
interface DataRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
  trend?: "up" | "down" | "neutral";
}

const TREND_COLORS: Record<string, string> = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-text-primary",
};

export function DataRow({ label, value, mono = true, trend }: DataRowProps) {
  const valueColor = trend ? TREND_COLORS[trend] : "text-text-primary";
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`text-sm font-medium ${valueColor} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
```

- [ ] **Step 7: Create SectionHeader component**

Create `app/components/ui/section-header.tsx`:

```tsx
import type { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  description?: string;
}

export function SectionHeader({ title, action, description }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div>
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {description && (
          <p className="mt-0.5 text-sm text-text-secondary">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 8: Verify all components render without build errors**

Run: `npm run build`

Expected: Build completes with no TypeScript or module errors.

- [ ] **Step 9: Commit**

```bash
git add app/components/ui/
git commit -m "feat(ui): add shared Card, Badge, Skeleton, TabBar, EmptyState, DataRow, SectionHeader components"
```

---

### Task 3: Header Polish — Active Route, Sticky Blur, Token Migration

**Files:**
- Modify: `app/components/header.tsx`
- Create: `app/components/nav-links.tsx` (client component for active route detection)
- Modify: `app/components/mobile-nav.tsx`
- Modify: `app/components/market-status.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 1, `Card` and `Badge` from Task 2 (indirectly — this task doesn't use them but later tasks do)
- Produces: Polished header with active route indicator, sticky blur, token-based colors. `NavLinks` client component with `({ user }) => JSX.Element` interface.

- [ ] **Step 1: Create NavLinks client component**

The `Header` is a server component and can't use `usePathname()`. Create a client component for the nav links:

Create `app/components/nav-links.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/macro", label: "Macro" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative text-sm transition-colors ${
              isActive
                ? "font-medium text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
            {isActive && (
              <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </>
  );
}
```

- [ ] **Step 2: Update Header to use tokens, sticky blur, and NavLinks**

Replace the contents of `app/components/header.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { MarketStatus } from "@/app/components/market-status";
import { MobileNav } from "@/app/components/mobile-nav";
import { NavLinks } from "@/app/components/nav-links";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 border-b border-border-primary bg-surface-primary/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2.5 md:px-6">
        <span className="text-lg font-semibold text-text-primary">
          AlphaStrat
        </span>
        <nav className="hidden items-center gap-5 md:flex">
          {user ? (
            <>
              <NavLinks />
              <MarketStatus />
              <span className="text-sm text-text-tertiary">
                {user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-sm text-text-tertiary transition-colors hover:text-text-primary"
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <NavLinks />
          )}
        </nav>
        <MobileNav
          user={user ? { email: user.email ?? "" } : null}
          logoutAction={logout}
        />
      </div>
    </header>
  );
}
```

Note: The `AlphaStrat` text is a `<span>` not a `<Link>` on purpose — the logo doesn't need to be a link to home on every page. If the original used a Link, keep it as a Link but apply the token classes.

Actually, looking at the original code, it is a Link. Keep it as a Link:

```tsx
import Link from "next/link";
```

And change the `<span>` back to:

```tsx
<Link href="/" className="text-lg font-semibold text-text-primary">
  AlphaStrat
</Link>
```

- [ ] **Step 3: Migrate MobileNav to use design tokens**

In `app/components/mobile-nav.tsx`, replace all hardcoded color classes:

- `bg-zinc-900 dark:bg-zinc-100` → `bg-text-primary` (for hamburger bars)
- `border-zinc-200 dark:border-zinc-800` → `border-border-primary`
- `bg-white dark:bg-zinc-950` → `bg-surface-primary`
- `bg-zinc-100 dark:bg-zinc-800` (active link bg) → `bg-surface-tertiary`
- `text-zinc-900 dark:text-zinc-100` → `text-text-primary`
- `text-zinc-600 dark:text-zinc-400` → `text-text-secondary`
- `text-zinc-500 dark:text-zinc-400` → `text-text-tertiary`
- `hover:bg-zinc-100 dark:hover:bg-zinc-800` → `hover:bg-surface-tertiary`
- `hover:text-zinc-900 dark:hover:text-zinc-100` → `hover:text-text-primary`

- [ ] **Step 4: Migrate MarketStatus to use design tokens**

In `app/components/market-status.tsx`:

- `text-zinc-500 dark:text-zinc-400` → `text-text-tertiary`
- Keep `bg-emerald-500`, `bg-amber-500`, `bg-red-500` for status dots — these are semantic colors that map to the tokens: change to `bg-success`, `bg-warning`, `bg-danger`

Update `STATUS_BY_STATE`:
```tsx
const STATUS_BY_STATE: Record<MarketState, Omit<StatusInfo, "state">> = {
  open: { label: "Market Open", dotClassName: "bg-success" },
  pre: { label: "Pre-Market", dotClassName: "bg-warning" },
  after: { label: "After Hours", dotClassName: "bg-warning" },
  closed: { label: "Market Closed", dotClassName: "bg-danger" },
};
```

- [ ] **Step 5: Verify header renders correctly**

Run: `npm run dev`

Check: Header should be sticky, have a frosted glass blur effect, show an accent underline on the active route, and use the new token colors.

- [ ] **Step 6: Commit**

```bash
git add app/components/header.tsx app/components/nav-links.tsx app/components/mobile-nav.tsx app/components/market-status.tsx
git commit -m "feat(header): add sticky blur, active route indicator, migrate to design tokens"
```

---

### Task 4: Login/Signup + Home Page Token Migration

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/signup/page.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 1
- Produces: Token-migrated auth pages and home page

- [ ] **Step 1: Migrate Login page**

In `app/login/page.tsx`, replace all hardcoded colors:

- Page heading `text-zinc-900 dark:text-zinc-100` → `text-text-primary`
- Labels `text-zinc-700 dark:text-zinc-300` → `text-text-secondary`
- Input borders `border-zinc-300 dark:border-zinc-700` → `border-border-primary`
- Input bg `bg-white dark:bg-zinc-950` → `bg-surface-primary`
- Input text `text-zinc-900 dark:text-zinc-100` → `text-text-primary`
- Input placeholder `placeholder:text-zinc-400` → `placeholder:text-text-tertiary`
- Input focus `focus:border-zinc-500` → `focus:border-accent`
- Error text `text-red-600 dark:text-red-400` → `text-danger`
- Button bg `bg-zinc-900 dark:bg-zinc-100` → `bg-accent`
- Button text `text-white dark:text-zinc-900` → `text-white` (accent is blue, white text works for both themes)
- Button hover `hover:bg-zinc-800 dark:hover:bg-zinc-200` → `hover:bg-accent/90`
- Link text `text-zinc-500 dark:text-zinc-400` → `text-text-tertiary`
- Link bold `text-zinc-900 dark:text-zinc-100` → `text-accent`

Add active press state to button: `active:scale-[0.98] transition-all`

Wrap the form area in a subtle card-like container:
```tsx
<div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12">
  <div className="w-full rounded-xl border border-border-primary bg-surface-secondary p-6">
    <h1 className="text-xl font-semibold text-text-primary">
      Log in to AlphaStrat
    </h1>
    <form ...>
    ...
    </form>
  </div>
  <p className="mt-6 ...">...</p>
</div>
```

- [ ] **Step 2: Migrate Signup page**

Apply the same token replacements as login. The signup success state uses emerald colors — replace:
- `border-emerald-200 dark:border-emerald-800` → `border-success/30`
- `bg-emerald-50 dark:bg-emerald-950` → `bg-success/10`
- `text-emerald-800 dark:text-emerald-200` → `text-success`
- `text-emerald-700 dark:text-emerald-300` → `text-success`

Wrap in the same card container as login.

- [ ] **Step 3: Migrate Home page**

In `app/page.tsx`:
- `text-zinc-900 dark:text-zinc-100` → `text-text-primary`
- `text-zinc-500 dark:text-zinc-400` → `text-text-secondary`
- Button: same accent treatment as login button

```tsx
export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-4xl font-bold tracking-tight text-text-primary">
        AlphaStrat
      </h1>
      <p className="mt-3 text-lg text-text-secondary">
        Personal finance dashboard
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/portfolio"
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-accent/90 active:scale-[0.98]"
        >
          Portfolio
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify visually**

Run dev server, check login page, signup page, and home page in both light and dark themes. Verify the card wrapper on login/signup, accent-colored buttons, and proper token colors.

- [ ] **Step 5: Commit**

```bash
git add app/login/page.tsx app/signup/page.tsx app/page.tsx
git commit -m "feat(auth): migrate login, signup, and home pages to design tokens"
```

---

### Task 5: Ticker Detail Panel Refactor — Extract Tab Components

**Files:**
- Modify: `app/watchlist/ticker-detail-panel.tsx` (refactor to thin shell)
- Create: `app/watchlist/tabs/overview-tab.tsx`
- Create: `app/watchlist/tabs/news-tab.tsx`
- Create: `app/watchlist/tabs/sentiment-tab.tsx`
- Create: `app/watchlist/tabs/thesis-tab.tsx`
- Create: `app/watchlist/tabs/earnings-tab.tsx`
- Create: `app/watchlist/tabs/options-tab.tsx`

**Interfaces:**
- Consumes: `TabBar` from Task 2. All existing types/interfaces from `ticker-detail-panel.tsx`.
- Produces: Six tab components, each receiving specific props:
  - `OverviewTab`: `({ quote, analyst, earnings, recommendation }) => JSX.Element`
  - `NewsTab`: `({ ticker }) => JSX.Element` (fetches own data)
  - `SentimentTab`: `({ ticker }) => JSX.Element` (fetches own data)
  - `ThesisTab`: `({ ticker }) => JSX.Element` (fetches own data)
  - `EarningsTab`: `({ ticker }) => JSX.Element` (fetches own data)
  - `OptionsTab`: `({ ticker }) => JSX.Element` (fetches own data)

This is the largest task — it's a pure refactor with no behavior changes. The goal is to split the 1400+ line file into focused per-tab files.

- [ ] **Step 1: Read the full ticker-detail-panel.tsx**

Read the entire file to understand all interfaces, helper functions, and tab rendering sections. Map out which state, effects, and helper functions belong to which tab.

- [ ] **Step 2: Create shared types file**

Create `app/watchlist/tabs/types.ts` with all the interfaces currently defined at the top of `ticker-detail-panel.tsx`: `NewsArticle`, `NewsTheme`, `TickerNews`, `RecommendationPeriod`, `RecommendationTrend`, `AdanosSource`, `SocialSentimentData`, `ThesisData`, `ThesisKeyMetric`, `EarningsTrendEntry`, `EarningsHistoryEntry`, `QuarterlyRevenueEntry`, `EarningsDetailData`, `OptionsAnalysisData`, and the `Tab` type.

Export all of them.

- [ ] **Step 3: Extract OverviewTab**

Create `app/watchlist/tabs/overview-tab.tsx`. Move the `{activeTab === "overview" && (...)}` JSX block and its dependencies:
- `RecBar` component
- `AnalystMeter` component
- Helper functions: `ratingColor`, `formatRating`, `formatMarketCap`, `formatRevenue`, `formatUsd`, `periodLabel`
- Props: `quote: QuoteData | null`, `analyst: AnalystData | null`, `earnings: EarningsData | null`, `recommendation: RecommendationTrend | null`

- [ ] **Step 4: Extract NewsTab**

Create `app/watchlist/tabs/news-tab.tsx`. Move the `{activeTab === "news" && (...)}` block:
- All news-related state (`newsData`, `newsLoading`, `newsError`)
- The news fetch `useEffect`
- Helper: `timeAgo`
- Props: `ticker: string`

- [ ] **Step 5: Extract SentimentTab**

Create `app/watchlist/tabs/sentiment-tab.tsx`. Move the `{activeTab === "sentiment" && (...)}` block:
- Social sentiment state (`socialData`, `socialLoading`, `socialError`, `socialFetched`)
- The sentiment fetch `useEffect` (triggers on mount since it's always visible when tab is active)
- Props: `ticker: string`

- [ ] **Step 6: Extract ThesisTab**

Create `app/watchlist/tabs/thesis-tab.tsx`. Move the `{activeTab === "thesis" && (...)}` block:
- Thesis state (`thesisData`, `thesisLoading`, `thesisError`, `thesisFetched`)
- The thesis fetch `useEffect`
- Props: `ticker: string`

- [ ] **Step 7: Extract EarningsTab**

Create `app/watchlist/tabs/earnings-tab.tsx`. Move the `{activeTab === "earnings" && (...)}` block:
- Earnings detail state (`earningsDetail`, `earningsDetailLoading`, `earningsDetailError`, `earningsFetched`)
- The earnings detail fetch `useEffect`
- All Recharts imports needed by earnings charts
- Helper: `earningsDateRelativeLabel`
- Props: `ticker: string`

- [ ] **Step 8: Extract OptionsTab**

Create `app/watchlist/tabs/options-tab.tsx`. Move the `{activeTab === "options" && (...)}` block:
- Options state (`optionsData`, `optionsLoading`, `optionsError`, `optionsFetched`)
- The options fetch `useEffect`
- All Recharts imports needed by options charts
- Props: `ticker: string`

- [ ] **Step 9: Refactor ticker-detail-panel.tsx to thin shell**

The parent component becomes ~100 lines:
- Import `TabBar` from `@/app/components/ui/tab-bar`
- Import all six tab components
- Keep only: `activeTab` state, the `tabs` array definition, the ticker header (symbol + price), and the conditional rendering
- Remove all tab-specific state, effects, and helper functions

```tsx
"use client";

import { useState } from "react";
import type { QuoteData, EarningsData, AnalystData } from "@/lib/market/types";
import type { RecommendationTrend, Tab } from "./tabs/types";
import { TabBar } from "@/app/components/ui/tab-bar";
import { OverviewTab } from "./tabs/overview-tab";
import { NewsTab } from "./tabs/news-tab";
import { SentimentTab } from "./tabs/sentiment-tab";
import { ThesisTab } from "./tabs/thesis-tab";
import { EarningsTab } from "./tabs/earnings-tab";
import { OptionsTab } from "./tabs/options-tab";

interface TickerDetailPanelProps {
  ticker: string;
  quote: QuoteData | null;
  analyst: AnalystData | null;
  earnings: EarningsData | null;
  recommendation: RecommendationTrend | null;
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
  analyst,
  earnings,
  recommendation,
}: TickerDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="border-t border-border-primary bg-surface-secondary px-4 py-4">
      <div className="mb-4">
        <TabBar tabs={TABS} activeTab={activeTab} onChange={(key) => setActiveTab(key as Tab)} />
      </div>

      {activeTab === "overview" && (
        <OverviewTab quote={quote} analyst={analyst} earnings={earnings} recommendation={recommendation} />
      )}
      {activeTab === "news" && <NewsTab ticker={ticker} />}
      {activeTab === "sentiment" && <SentimentTab ticker={ticker} />}
      {activeTab === "thesis" && <ThesisTab ticker={ticker} />}
      {activeTab === "earnings" && <EarningsTab ticker={ticker} />}
      {activeTab === "options" && <OptionsTab ticker={ticker} />}
    </div>
  );
}
```

- [ ] **Step 10: Verify the refactor**

Run: `npm run build`

Expected: Build succeeds. No TypeScript errors.

Run: `npm run dev`

Open watchlist, expand a ticker, click through all 6 tabs. Every tab should render identically to before the refactor.

- [ ] **Step 11: Commit**

```bash
git add app/watchlist/ticker-detail-panel.tsx app/watchlist/tabs/
git commit -m "refactor(watchlist): extract ticker detail tabs into focused per-tab components"
```

---

### Task 6: Watchlist Page Token Migration + Visual Polish

**Files:**
- Modify: `app/watchlist/watchlist-dashboard.tsx`
- Modify: `app/watchlist/bottom-sheet.tsx`
- Modify: `app/watchlist/tabs/overview-tab.tsx` (from Task 5)
- Modify: `app/watchlist/tabs/news-tab.tsx` (from Task 5)
- Modify: `app/watchlist/tabs/sentiment-tab.tsx` (from Task 5)
- Modify: `app/watchlist/tabs/thesis-tab.tsx` (from Task 5)
- Modify: `app/watchlist/tabs/earnings-tab.tsx` (from Task 5)
- Modify: `app/watchlist/tabs/options-tab.tsx` (from Task 5)

**Interfaces:**
- Consumes: Design tokens from Task 1, `Card`/`Badge`/`Skeleton`/`DataRow` from Task 2, tab components from Task 5
- Produces: Fully polished watchlist page with token-based colors, skeleton loading, and hover effects

- [ ] **Step 1: Migrate watchlist-dashboard.tsx colors**

Replace all hardcoded color classes throughout `watchlist-dashboard.tsx`:

- `text-emerald-500` (positive change) → `text-success`
- `text-red-500` / `text-red-600` / `text-red-400` → `text-danger`
- `text-amber-500` → `text-warning`
- `text-zinc-900 dark:text-zinc-100` → `text-text-primary`
- `text-zinc-600 dark:text-zinc-400` / `text-zinc-500 dark:text-zinc-400` → `text-text-secondary`
- `text-zinc-400 dark:text-zinc-500` → `text-text-tertiary`
- `text-zinc-700 dark:text-zinc-300` → `text-text-primary`
- `border-zinc-200 dark:border-zinc-800` → `border-border-primary`
- `bg-zinc-50 dark:bg-zinc-900/50` → `bg-surface-secondary`
- `bg-zinc-100 dark:bg-zinc-800` → `bg-surface-tertiary`
- `bg-white dark:bg-zinc-950` → `bg-surface-primary`
- `hover:bg-zinc-100 dark:hover:bg-zinc-800/50` → `hover:bg-surface-tertiary`
- `bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900` → `bg-accent text-white`

Update `changeColor` function:
```tsx
function changeColor(value: number): string {
  if (value > 0) return "text-success";
  if (value < 0) return "text-danger";
  return "text-text-secondary";
}
```

Update `ratingColor` function:
```tsx
function ratingColor(key: string | null | undefined): string {
  if (!key) return "text-text-secondary";
  if (key === "strong_buy" || key === "buy") return "text-success";
  if (key === "hold") return "text-warning";
  return "text-danger";
}
```

Add hover effects to watchlist table rows:
```tsx
className="... transition-colors hover:bg-surface-tertiary/50 cursor-pointer"
```

- [ ] **Step 2: Migrate bottom-sheet.tsx colors**

Replace in `app/watchlist/bottom-sheet.tsx`:
- `bg-white dark:bg-zinc-950` → `bg-surface-primary`
- `bg-zinc-300 dark:bg-zinc-700` → `bg-border-secondary`
- `border-zinc-200 dark:border-zinc-800` → `border-border-primary`
- `text-zinc-900 dark:text-zinc-100` → `text-text-primary`
- `text-zinc-500 dark:text-zinc-400` / `text-zinc-400 dark:hover:text-zinc-100` → `text-text-tertiary`
- `hover:bg-zinc-100 dark:hover:bg-zinc-800` → `hover:bg-surface-tertiary`
- `hover:text-zinc-900 dark:hover:text-zinc-100` → `hover:text-text-primary`

- [ ] **Step 3: Migrate all tab component colors**

Apply the same token migration pattern to each of the six tab files created in Task 5. For each file:

- Replace all `zinc-*`, `emerald-*`, `red-*`, `amber-*`, `blue-*` color classes with token equivalents
- Use `Badge` component for sentiment labels where appropriate (thesis rating, sentiment labels)
- Use `Card` component for content cards within tabs
- Use `DataRow` for label-value pairs
- Use `Skeleton` for loading states (replace "Loading..." text with `<Skeleton className="h-4 w-32" />` patterns)

Each tab should show skeleton placeholders while its data is loading instead of text spinners.

- [ ] **Step 4: Add expand/collapse animation to watchlist rows**

In `watchlist-dashboard.tsx`, wrap the detail panel in an animated container:

```tsx
<div className={`grid ${expandedTicker === item.ticker ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} expand-collapse`}>
  <div className="overflow-hidden">
    {expandedTicker === item.ticker && (
      <TickerDetailPanel ... />
    )}
  </div>
</div>
```

Note: The expand/collapse animation requires the content to be rendered (not conditionally unmounted) for the transition to work. However, since each tab fetches data on mount, lazy rendering with conditional mount is better for performance. Keep the conditional rendering (`expandedTicker === item.ticker &&`) and add a simple `animate-fade-in` class to the panel instead:

```tsx
{expandedTicker === item.ticker && (
  <div className="animate-fade-in">
    <TickerDetailPanel ... />
  </div>
)}
```

- [ ] **Step 5: Verify visually**

Run dev server, test:
1. Watchlist table with token colors
2. Expand a ticker — check fade-in animation
3. Click through all tabs — verify token colors and skeleton loading
4. Bottom sheet on mobile viewport
5. Both light and dark themes

- [ ] **Step 6: Commit**

```bash
git add app/watchlist/
git commit -m "feat(watchlist): migrate to design tokens, add skeleton loading and animations"
```

---

### Task 7: Portfolio Page Token Migration + Visual Polish

**Files:**
- Modify: `app/portfolio/page.tsx`
- Modify: `app/portfolio/portfolio-dashboard.tsx`
- Modify: `app/portfolio/positions-table.tsx`
- Modify: `app/portfolio/allocation-chart.tsx`
- Modify: `app/portfolio/risk-metrics-card.tsx`
- Modify: `app/portfolio/performance-chart.tsx`
- Modify: `app/portfolio/ai-summary-card.tsx`
- Modify: `app/portfolio/add-position-form.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 1, `Card`/`SectionHeader`/`EmptyState`/`DataRow`/`Skeleton` from Task 2
- Produces: Fully polished portfolio page

- [ ] **Step 1: Read all portfolio component files**

Read each file to understand its current styles before migrating.

- [ ] **Step 2: Migrate portfolio/page.tsx**

Replace all hardcoded colors with tokens:
- Page title/description: use `text-text-primary`, `text-text-secondary`
- Section headings: use `SectionHeader` component
- Wrap major sections in consistent spacing

```tsx
<div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
  <SectionHeader title="Portfolio" description="Track your positions and see how your portfolio is allocated." />
  <section className="mt-6">
    <SectionHeader title="Add Position" />
    <div className="mt-4">
      <AddPositionForm />
    </div>
  </section>
  <section className="mt-8">
    <SectionHeader title="Your Positions" />
    <div className="mt-4">
      <PortfolioDashboard positions={(positions as Position[]) ?? []} />
    </div>
  </section>
</div>
```

- [ ] **Step 3: Migrate portfolio-dashboard.tsx**

Replace all `zinc-*`, `emerald-*`, `red-*` colors with tokens. Key replacements:
- P&L colors: `text-emerald-*` → `text-success`, `text-red-*` → `text-danger`
- Borders: `border-zinc-200 dark:border-zinc-800` → `border-border-primary`
- Backgrounds: `bg-white dark:bg-zinc-950` → `bg-surface-primary`, `bg-zinc-50 dark:bg-zinc-900` → `bg-surface-secondary`
- Text: standard token migration

Add `EmptyState` when positions array is empty:
```tsx
if (positions.length === 0) {
  return <EmptyState title="No positions yet" description="Add a position above to start tracking your portfolio." />;
}
```

- [ ] **Step 4: Migrate remaining portfolio components**

Apply the same token migration to:
- `positions-table.tsx` — table headers, cell colors, P&L coloring
- `allocation-chart.tsx` — text labels, card borders
- `risk-metrics-card.tsx` — wrap in `Card`, use `DataRow` for metrics
- `performance-chart.tsx` — text labels, card borders
- `ai-summary-card.tsx` — wrap in `Card`, use tokens for text
- `add-position-form.tsx` — input styling matches login page pattern (tokens for borders, focus, text)

- [ ] **Step 5: Verify visually**

Run dev server, test portfolio page:
1. Empty state when no positions
2. Position cards with hover effects
3. P&L color coding (green/red)
4. Charts render correctly
5. Both themes

- [ ] **Step 6: Commit**

```bash
git add app/portfolio/
git commit -m "feat(portfolio): migrate to design tokens, add Card/EmptyState/SectionHeader components"
```

---

### Task 8: Macro Dashboard Token Migration + Visual Polish

**Files:**
- Modify: `app/macro/macro-dashboard.tsx`

**Interfaces:**
- Consumes: Design tokens from Task 1, `Card`/`Badge`/`Skeleton`/`SectionHeader` from Task 2
- Produces: Fully polished macro dashboard

- [ ] **Step 1: Read the full macro-dashboard.tsx**

Read the entire file to understand the current `CATEGORY_STYLES` pattern and all color references.

- [ ] **Step 2: Migrate macro-dashboard.tsx colors**

Replace all hardcoded colors:
- `text-zinc-*` → appropriate `text-text-*` token
- `border-zinc-*` → `border-border-primary`
- `bg-zinc-*` → appropriate `bg-surface-*` token
- `bg-white dark:bg-zinc-950` → `bg-surface-primary`

For `CATEGORY_STYLES`, keep the per-category accent colors (violet, rose, sky, amber, emerald) as visual identity — these are intentional design choices, not generic zinc colors. Only migrate the dark-mode fallback patterns if they use zinc.

Replace the market outlook sentiment badge rendering with the `Badge` component:
```tsx
<Badge variant={sentimentLabel === "Bullish" ? "bullish" : sentimentLabel === "Bearish" ? "bearish" : sentimentLabel === "Cautious" ? "mixed" : "neutral"}>
  {sentimentLabel}
</Badge>
```

- [ ] **Step 3: Add expand/collapse animation**

Wrap category content in the animated grid pattern:
```tsx
<div className={`grid ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} expand-collapse`}>
  <div className="overflow-hidden">
    {/* category content */}
  </div>
</div>
```

- [ ] **Step 4: Add staggered fade-in for category cards**

Wrap each category card with a stagger delay:
```tsx
<div
  key={category.id}
  className="animate-fade-in"
  style={{ animationDelay: `${index * 50}ms` }}
>
```

- [ ] **Step 5: Add skeleton loading state**

Replace the loading spinner/text with skeleton placeholders:
```tsx
{loading && (
  <div className="space-y-4">
    {[...Array(3)].map((_, i) => (
      <Card key={i}>
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-3 h-16 w-full" />
      </Card>
    ))}
  </div>
)}
```

- [ ] **Step 6: Verify visually**

Run dev server, test macro dashboard:
1. Category cards with accent colors preserved
2. Expand/collapse animation works smoothly
3. Staggered fade-in on initial load
4. Skeleton loading state
5. Market mood section styling
6. Both themes

- [ ] **Step 7: Commit**

```bash
git add app/macro/macro-dashboard.tsx
git commit -m "feat(macro): migrate to design tokens, add animations and skeleton loading"
```

---

### Task 9: Performance — Suspense Boundaries + Dynamic Imports

**Files:**
- Modify: `app/watchlist/tabs/earnings-tab.tsx`
- Modify: `app/watchlist/tabs/options-tab.tsx`
- Modify: `app/watchlist/ticker-detail-panel.tsx`

**Interfaces:**
- Consumes: `Skeleton` from Task 2, tab components from Task 5
- Produces: Lazy-loaded heavy tabs with skeleton fallbacks

- [ ] **Step 1: Add dynamic imports for Recharts-heavy tabs**

In `app/watchlist/ticker-detail-panel.tsx`, use `next/dynamic` for the earnings and options tabs:

```tsx
import dynamic from "next/dynamic";
import { Skeleton } from "@/app/components/ui/skeleton";

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

const EarningsTab = dynamic(() => import("./tabs/earnings-tab").then(m => ({ default: m.EarningsTab })), {
  loading: () => <TabSkeleton />,
});

const OptionsTab = dynamic(() => import("./tabs/options-tab").then(m => ({ default: m.OptionsTab })), {
  loading: () => <TabSkeleton />,
});
```

Keep the other tabs as static imports since they're lightweight.

- [ ] **Step 2: Verify lazy loading works**

Run dev server, open Network tab in browser DevTools. When expanding a ticker:
- Earnings and Options tab code should NOT be loaded initially
- Clicking the Earnings tab should trigger a chunk load
- Clicking the Options tab should trigger a chunk load
- Both tabs should show the skeleton briefly, then the content

- [ ] **Step 3: Commit**

```bash
git add app/watchlist/ticker-detail-panel.tsx
git commit -m "perf(watchlist): lazy-load earnings and options tabs with dynamic imports"
```

---

### Task 10: Final Polish — Docs Update + Visual QA

**Files:**
- Modify: `DECISIONS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: All previous tasks
- Produces: Updated documentation, verified visual polish across all pages

- [ ] **Step 1: Add Phase 11 decisions to DECISIONS.md**

Append new decisions:

```markdown
### Decision 58: Design Token System (Phase 11)
**Context:** All colors were hardcoded as Tailwind `zinc-*` classes, duplicated across every component.
**Decision:** Centralized CSS custom properties in `globals.css`, exposed via `@theme inline` for Tailwind class usage (`bg-surface-secondary`, `text-text-primary`, etc.).
**Tradeoff:** Slight learning curve for new token names vs. consistent, themeable color system across the entire app.

### Decision 59: Shared UI Component Library (Phase 11)
**Context:** Cards, badges, tabs, and loading states were re-implemented differently on every page.
**Decision:** Extracted 7 shared components to `app/components/ui/`: Card, Badge, Skeleton, TabBar, EmptyState, DataRow, SectionHeader.
**Tradeoff:** Components are intentionally minimal (no complex prop APIs or variants) to avoid premature abstraction.

### Decision 60: Ticker Detail Panel Refactor (Phase 11)
**Context:** `ticker-detail-panel.tsx` was 1400+ lines with all 6 tabs in one file.
**Decision:** Split into a thin shell parent + 6 focused tab components in `app/watchlist/tabs/`. Each tab owns its data fetching and state.
**Tradeoff:** More files to navigate vs. each file is focused and independently modifiable.

### Decision 61: Animation System (Phase 11)
**Context:** Zero animations — all state changes were instant, contributing to an "AI-generated" feel.
**Decision:** CSS-only animation system: `@keyframes` for shimmer/fade/slide, utility classes, `prefers-reduced-motion` respected. No animation library added.
**Tradeoff:** CSS-only limits complex choreography but avoids bundle size increase and keeps animations performant (GPU-composited).

### Decision 62: Dynamic Imports for Heavy Tabs (Phase 11)
**Context:** Recharts bundles for earnings and options charts loaded on every watchlist page view.
**Decision:** `next/dynamic` for EarningsTab and OptionsTab with skeleton fallbacks.
**Tradeoff:** Brief loading skeleton on first tab click vs. faster initial page load.
```

- [ ] **Step 2: Update CLAUDE.md key files section**

Add to the Key Files section:
```markdown
- `app/components/ui/` — shared UI components (Card, Badge, Skeleton, TabBar, EmptyState, DataRow, SectionHeader)
- `app/components/nav-links.tsx` — client-side nav with active route indicator
- `app/watchlist/tabs/` — per-tab components for ticker detail (overview, news, sentiment, thesis, earnings, options)
- `app/watchlist/tabs/types.ts` — shared type definitions for ticker detail tabs
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest`

Expected: All tests pass.

- [ ] **Step 4: Run production build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 5: Visual QA checklist**

Run dev server and verify each page in both light and dark themes:

1. **Home page:** Accent button, clean typography, centered layout
2. **Login/Signup:** Card wrapper, accent focus rings, error states in red token
3. **Header:** Sticky with blur, active route underline, market status dots
4. **Watchlist:** Table row hover effects, expand animation, tab underline slides, skeleton loading in tabs
5. **Portfolio:** Section headers, card hover, P&L colors, empty state
6. **Macro:** Category cards with accent colors, expand/collapse animation, staggered fade-in, skeleton loading
7. **Mobile:** Hamburger menu, bottom sheet, responsive layouts

- [ ] **Step 6: Commit**

```bash
git add DECISIONS.md CLAUDE.md
git commit -m "docs: add Phase 11 decisions and update CLAUDE.md key files"
```
