@AGENTS.md

# AlphaStrat — Personal Finance Web App

## Tech Stack
- Next.js 16.3 (App Router, React 19, TypeScript, Tailwind CSS v4)
- Supabase (Auth + Postgres with RLS)
- Recharts for charts
- Deployed on Vercel free tier
- Cost control is the overriding constraint

## Architecture
- No Python — all data fetching via Node.js `fetch()` directly
- Yahoo Finance v8/v10 REST endpoints for market data (no yfinance)
- Reddit OAuth HTTP API for sentiment (no PRAW) — Phase 5
- Generic cache utility: `lib/cache/index.ts` → `getOrFetch<T>()`
- Cache table with `cache_key`, `cache_type`, `data` (jsonb), `expires_at`
- Pure financial calculation functions in `lib/finance/` — all unit tested
- Server Actions for mutations, API Routes for data fetching
- `cookies()` is async in Next.js 16
- `useActionState` (React 19) for form handling

## Key Files
- `lib/cache/index.ts` — generic cache-first utility
- `lib/cache/freshness.ts` — TTL constants
- `lib/market/yahoo.ts` — Yahoo Finance client (getQuote, getHistorical)
- `lib/finance/pnl.ts`, `risk.ts`, `allocation.ts` — pure calculation functions
- `app/portfolio/actions.ts` — server actions (addPosition, addTransaction, deletePosition)
- `app/api/market/quote/route.ts` — quote API with caching
- `app/api/market/search/route.ts` — ticker autocomplete via Yahoo search
- `app/api/analysis/risk-metrics/route.ts` — beta, Sharpe vs SPY benchmark

## Database Tables
- `positions` — user_id, ticker, quantity, cost_basis (blended average)
- `cache` — generic cache with jsonb data and expiry

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx vitest` — run tests

## Subagent Workflow
- Opus orchestrates and reviews
- Sonnet subagents implement (use `model: "sonnet"` on Agent tool)
- Update `DECISIONS.md` after each significant engineering decision
