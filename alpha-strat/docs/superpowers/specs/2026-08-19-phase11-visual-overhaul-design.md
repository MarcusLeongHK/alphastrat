# Phase 11: Full Visual Overhaul — Design Spec

## Goal

Transform AlphaStrat from a functional prototype into a polished financial product. Establish a design token system, add purposeful animations, extract shared components, and apply consistent visual treatment across all pages. The result should feel closer to TradingView (data density, professional typography) and Robinhood (clean surfaces, smooth interactions) than a typical AI-generated dashboard.

## Non-Goals

- No new features or data sources
- No backend/API changes
- No database schema changes
- No dependency additions beyond what's already installed (Tailwind, Recharts, Geist fonts)

## Design Direction

**Visual identity:** Dark-first, data-dense financial tool. Cool neutral palette with blue accent. Monospace for data values, sans-serif for labels and prose. Cards with subtle borders, not heavy shadows.

**Motion philosophy:** Animations serve comprehension, not decoration. Every animation answers "where did this come from?" or "what changed?" If removing an animation doesn't reduce clarity, remove it. All animations respect `prefers-reduced-motion`.

**Component philosophy:** Extract shared patterns only when 3+ pages use the same visual treatment. Keep components small and focused — a `Card` is a surface with consistent tokens, not a kitchen-sink wrapper.

---

## 1. Design Tokens & Color System

### 1.1 Color Tokens

Defined in `globals.css` via CSS custom properties, exposed to Tailwind through `@theme inline`.

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--surface-primary` | `#ffffff` | `#0f0f11` | Page background |
| `--surface-secondary` | `#f8f8fa` | `#18181b` | Cards, panels |
| `--surface-tertiary` | `#f0f0f3` | `#222225` | Nested containers, hover |
| `--border-primary` | `#e4e4e7` | `#2a2a2e` | Card borders, dividers |
| `--border-secondary` | `#d4d4d8` | `#3a3a3e` | Active/focus borders |
| `--text-primary` | `#09090b` | `#fafafa` | Headings, body text |
| `--text-secondary` | `#52525b` | `#a1a1aa` | Labels, descriptions |
| `--text-tertiary` | `#71717a` | `#71717a` | Timestamps, metadata |
| `--accent` | `#2563eb` | `#3b82f6` | Links, active tabs, CTAs |
| `--accent-muted` | `#dbeafe` | `#1e3a5f` | Badge backgrounds, highlights |
| `--success` | `#16a34a` | `#22c55e` | Positive values, bullish |
| `--danger` | `#dc2626` | `#ef4444` | Negative values, bearish |
| `--warning` | `#d97706` | `#f59e0b` | Neutral/mixed signals |

### 1.2 Typography Tokens

- `--font-display`: Geist Sans — page titles, ticker symbols, section headers
- `--font-body`: Geist Sans — body text, descriptions, labels
- `--font-mono`: Geist Mono — prices, percentages, numerical data, code

Type scale (rem-based, on 4px grid):
- `--text-xs`: 0.75rem / 1rem line-height
- `--text-sm`: 0.875rem / 1.25rem
- `--text-base`: 1rem / 1.5rem
- `--text-lg`: 1.125rem / 1.75rem
- `--text-xl`: 1.25rem / 1.75rem
- `--text-2xl`: 1.5rem / 2rem

### 1.3 Spacing

Use Tailwind's 4px grid consistently. Establish page-level patterns:
- Page padding: `px-4 md:px-6` (16px mobile, 24px desktop)
- Section gap: `gap-6` (24px) between major sections
- Card padding: `p-4 md:p-5` (16px mobile, 20px desktop)
- Inline element gap: `gap-2` (8px) for chips, badges, inline items

### 1.4 Implementation

All tokens defined in `globals.css` `:root` block (light) and `@media (prefers-color-scheme: dark)` block. Exposed to Tailwind via `@theme inline` so classes like `bg-surface-secondary`, `text-text-primary`, `border-border-primary` work throughout the codebase.

Migration: Replace all hardcoded `zinc-*`, `blue-*`, `green-*`, `red-*` color references with token-based classes. This is a find-and-replace operation across all component files.

---

## 2. Animation & Motion System

### 2.1 Keyframe Animations (globals.css)

```css
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
```

### 2.2 Utility Classes

```css
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
```

### 2.3 Transition Utilities

```css
.transition-colors-fast { transition: color 120ms, background-color 120ms, border-color 120ms; }
.transition-transform-fast { transition: transform 80ms ease-out; }
.expand-collapse { transition: grid-template-rows 200ms ease-out; }
```

### 2.4 Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .animate-shimmer, .animate-fade-in, .animate-slide-up {
    animation: none;
  }
  .transition-colors-fast, .transition-transform-fast, .expand-collapse {
    transition: none;
  }
}
```

### 2.5 Micro-Interactions (applied via Tailwind classes)

- **Card hover:** `hover:-translate-y-px hover:border-border-secondary` with `transition-all duration-120`
- **Button press:** `active:scale-[0.98]` with `transition-transform-fast`
- **Tab underline:** Sliding indicator via CSS `transform: translateX()` keyed to active tab index
- **Expand/collapse:** Wrapper `div` with `grid grid-rows-[0fr]` → `grid-rows-[1fr]` toggle, inner `div` with `overflow-hidden`
- **Staggered list entry:** Each item gets `animate-fade-in` with `animation-delay: calc(var(--index) * 30ms)`

---

## 3. Shared Component Library

All components in `app/components/ui/`. Each uses design tokens exclusively — no hardcoded colors.

### 3.1 Card

```tsx
// app/components/ui/card.tsx
interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean; // enables hover lift effect
}
```

Renders a `div` with `bg-surface-secondary border border-border-primary rounded-lg` and optional hover animation. Replaces all ad-hoc card-like containers across the app.

### 3.2 TabBar

```tsx
// app/components/ui/tab-bar.tsx
interface TabBarProps {
  tabs: { key: string; label: string }[];
  activeTab: string;
  onChange: (key: string) => void;
}
```

Horizontal tab strip with sliding underline indicator. The underline animates between tabs using `transform: translateX()` and `transition`. Replaces the current tab implementations in watchlist detail and macro dashboard.

### 3.3 Badge

```tsx
// app/components/ui/badge.tsx
interface BadgeProps {
  variant: "bullish" | "bearish" | "neutral" | "mixed" | "info";
  children: ReactNode;
  size?: "sm" | "md";
}
```

Semantic color pill. Maps variants to token pairs: bullish → success/success-muted, bearish → danger/danger-muted, etc.

### 3.4 Skeleton

```tsx
// app/components/ui/skeleton.tsx
interface SkeletonProps {
  className?: string; // controls width, height, rounded
}
```

A `div` with `animate-shimmer rounded` and configurable dimensions. Used as loading placeholder for text lines, cards, charts.

### 3.5 EmptyState

```tsx
// app/components/ui/empty-state.tsx
interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

Centered message with optional icon and CTA button. Used when watchlist is empty, portfolio has no positions, etc.

### 3.6 DataRow

```tsx
// app/components/ui/data-row.tsx
interface DataRowProps {
  label: string;
  value: string | number;
  mono?: boolean; // defaults true, uses font-mono for value
  trend?: "up" | "down" | "neutral";
}
```

Horizontal label-value pair. Value right-aligned in monospace. Trend colors the value with semantic tokens.

### 3.7 SectionHeader

```tsx
// app/components/ui/section-header.tsx
interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  description?: string;
}
```

Consistent heading with optional right-aligned action and subtitle.

---

## 4. Per-Page Improvements

### 4.1 Header & Navigation

- **Active route indicator:** Accent-colored underline on the current page's nav link, using `usePathname()` to determine active state
- **Sticky + blur:** `sticky top-0 z-50 backdrop-blur-md bg-surface-primary/80` — header stays visible on scroll with frosted glass effect
- **Tighter spacing:** Reduce vertical padding from `py-3` to `py-2.5`, tighten nav link gaps

### 4.2 Watchlist Page

**Ticker detail refactor:** Split `ticker-detail-panel.tsx` (1400+ lines) into:
- `app/watchlist/tabs/thesis-tab.tsx` — thesis content with rating gauge and case cards
- `app/watchlist/tabs/news-tab.tsx` — theme chips and filtered sources
- `app/watchlist/tabs/options-tab.tsx` — options chain analysis
- `app/watchlist/tabs/earnings-tab.tsx` — earnings calendar and history
- `app/watchlist/tabs/sentiment-tab.tsx` — social sentiment comparison

Each tab file receives the ticker and any pre-fetched data as props. The parent `ticker-detail-panel.tsx` becomes a thin shell: ticker header + `TabBar` + conditional tab rendering.

**Visual improvements:**
- Replace instant tab switch with cross-fade animation
- Add `Skeleton` loading states for each tab's data fetch
- Sticky ticker header (symbol + price) when scrolling within detail panel
- Smooth expand/collapse animation when selecting/deselecting a ticker row
- Card hover effects on watchlist table rows

### 4.3 Portfolio Page

- Wrap position rows in `Card` components with hover effects
- Color-code P&L values: green for positive, red for negative using semantic tokens
- Add `Skeleton` states for quote data loading
- Better visual hierarchy: summary stats in a prominent card at top, positions below
- `DataRow` for key metrics (total value, day change, total P&L)
- `EmptyState` when no positions exist

### 4.4 Macro Dashboard

- Wrap each category in `Card` with consistent padding
- Smooth expand/collapse animation for category sections (grid-rows technique)
- `Badge` component for sentiment indicators
- Horizontal scrolling chip layout for driver chips (inline pattern, not a shared component — only macro uses this specific layout)
- Market mood summary card at top with prominent styling
- Staggered fade-in for category cards on initial load

### 4.5 Login/Signup Pages

- Center form in viewport with `Card` wrapper
- Subtle gradient background (`surface-primary` → `surface-secondary`)
- Focus ring styling using `--accent` token
- Error states with `--danger` token
- Consistent button styling with hover/active micro-interactions

---

## 5. Performance & Loading

### 5.1 Suspense Boundaries

Wrap each ticker detail tab in `<Suspense fallback={<TabSkeleton />}>`. Each tab fetches its own data independently — a slow thesis fetch doesn't block the news tab from rendering.

### 5.2 Dynamic Imports

Heavy components that aren't needed on initial render:
- Recharts components (only needed when chart tab is active)
- Options analysis (complex calculations, only when options tab is open)

Use Next.js `dynamic()` with `{ loading: () => <Skeleton /> }`.

### 5.3 Layout Stability

Every skeleton placeholder matches the dimensions of its loaded counterpart. No cumulative layout shift when data arrives. Skeleton for a data row is the same height as a loaded data row.

---

## 6. Implementation Phasing

### Phase 11a — Foundation (1 PR)
1. Design tokens in `globals.css` (color, typography, spacing)
2. Animation keyframes and utility classes in `globals.css`
3. Shared components: `Card`, `Badge`, `Skeleton`, `TabBar`, `EmptyState`, `DataRow`, `SectionHeader`
4. Header polish: active route, sticky blur, tighter spacing
5. Migrate `globals.css` to use new token system

### Phase 11b — Page Polish (1 PR)
1. Refactor `ticker-detail-panel.tsx` into tab sub-components
2. Apply tokens + shared components to Watchlist page
3. Apply tokens + shared components to Portfolio page
4. Apply tokens + shared components to Macro Dashboard
5. Apply tokens + shared components to Login/Signup
6. Add expand/collapse animations, tab transitions, hover effects
7. Add skeleton loading states to all data-fetching components

### Phase 11c — Performance & Final Touches (1 PR)
1. `Suspense` boundaries around ticker detail tabs
2. Dynamic imports for Recharts and heavy components
3. Staggered list animations
4. Empty states for zero-data scenarios
5. Responsive polish pass (mobile edge cases)
6. Final visual QA across all pages in both themes

---

## 7. Testing Strategy

- Visual verification via dev server for each sub-phase
- Test both light and dark themes
- Test mobile and desktop viewports
- Verify `prefers-reduced-motion` disables animations
- Run existing test suite to confirm no regressions
- No new unit tests needed (pure visual changes, no logic changes)

## 8. Files Affected

### New Files
- `app/components/ui/card.tsx`
- `app/components/ui/tab-bar.tsx`
- `app/components/ui/badge.tsx`
- `app/components/ui/skeleton.tsx`
- `app/components/ui/empty-state.tsx`
- `app/components/ui/data-row.tsx`
- `app/components/ui/section-header.tsx`
- `app/watchlist/tabs/thesis-tab.tsx`
- `app/watchlist/tabs/news-tab.tsx`
- `app/watchlist/tabs/options-tab.tsx`
- `app/watchlist/tabs/earnings-tab.tsx`
- `app/watchlist/tabs/sentiment-tab.tsx`

### Modified Files
- `app/globals.css` — design tokens, animations, utilities
- `app/layout.tsx` — token integration
- `app/components/header.tsx` — active route, sticky blur
- `app/components/mobile-nav.tsx` — token migration
- `app/components/market-status.tsx` — token migration
- `app/watchlist/watchlist-dashboard.tsx` — token migration, shared components
- `app/watchlist/ticker-detail-panel.tsx` — refactor to tab shell
- `app/watchlist/bottom-sheet.tsx` — token migration
- `app/portfolio/page.tsx` — token migration, shared components
- `app/macro/macro-dashboard.tsx` — token migration, shared components
- `app/login/page.tsx` — token migration, card layout
- `app/signup/page.tsx` — token migration, card layout
- `app/page.tsx` — token migration (landing/home)
