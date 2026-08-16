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
- No heavy SDKs — direct REST `fetch()` for AI providers (Groq, Gemini)
- Yahoo Finance v8/v10 REST endpoints for market data (no yfinance)
- Adanos API for social sentiment (Reddit + Twitter/X), multi-key round-robin — Phase 5
- Reddit RSS as fallback sentiment source
- Generic cache utility: `lib/cache/index.ts` → `getOrFetch<T>()` with `user_id` + composite upsert
- Cache table with `user_id`, `cache_key`, `cache_type`, `data` (jsonb), `expires_at` — unique on `(user_id, cache_key)`
- Shared cache: `getOrFetch<T>(..., { shared: true })` uses `user_id IS NULL` + partial unique index for cross-user caching (e.g., macro news)
- Pure financial calculation functions in `lib/finance/` — all unit tested
- Server Actions for mutations, API Routes for data fetching
- `cookies()` is async in Next.js 16
- `useActionState` (React 19) for form handling

## Auth (Phase 2)
- Supabase Auth with email/password via `@supabase/ssr` cookies
- `proxy.ts` (NOT middleware.ts — Next.js 16.3 uses proxy) for session refresh + route protection
- `getClaims()` for API route auth (fast JWT verification), `getUser()` for mutations and pages
- Auth server actions in `app/auth/actions.ts` (signup, login, logout)
- Auth callback at `app/auth/callback/route.ts` for email confirmation
- Header component shows user email + logout when authenticated
- RLS policies enforce `auth.uid() = user_id` on positions and transactions

## Key Files
- `proxy.ts` — session refresh, route protection (Next.js 16 proxy)
- `lib/supabase/server.ts` — server-side Supabase client with cookie handling
- `lib/supabase/client.ts` — browser-side Supabase client
- `lib/cache/index.ts` — generic cache-first utility
- `lib/cache/freshness.ts` — TTL constants
- `lib/market/yahoo.ts` — Yahoo Finance client (getQuote, getHistorical)
- `lib/finance/pnl.ts`, `risk.ts`, `allocation.ts` — pure calculation functions
- `app/auth/actions.ts` — auth server actions (signup, login, logout)
- `app/auth/callback/route.ts` — email confirmation callback
- `app/portfolio/actions.ts` — server actions (addPosition, addTransaction, deletePosition)
- `app/api/market/quote/route.ts` — quote API with caching
- `app/api/market/search/route.ts` — ticker autocomplete via Yahoo search
- `app/api/analysis/risk-metrics/route.ts` — beta, Sharpe vs SPY benchmark
- `app/api/watchlist/route.ts` — watchlist CRUD API
- `app/api/market/earnings/route.ts` — earnings calendar data
- `app/api/market/analyst/route.ts` — analyst ratings and price targets
- `app/watchlist/actions.ts` — watchlist server actions
- `lib/ai/client.ts` — dual-provider AI client (Groq for summaries, Gemini for thesis)
- `lib/ai/prompts.ts` — system prompts and prompt builders
- `lib/market/adanos.ts` — Adanos API client (Reddit + Twitter/X sentiment, multi-key round-robin)
- `lib/market/reddit.ts` — Reddit RSS sentiment fetcher (fallback, multi-subreddit search)
- `lib/market/stocktwits.ts` — StockTwits sentiment client (blocked by Cloudflare as of Aug 2026)
- `lib/ai/news-summary.ts` — AI news summarization
- `lib/ai/reddit-sentiment.ts` — Groq-powered Reddit sentiment analysis
- `lib/ai/sentiment-comparison.ts` — Groq-powered retail vs institutional comparison
- `app/api/market/news/route.ts` — news + AI summary per ticker
- `app/api/market/sentiment/route.ts` — analyst recommendation trend data
- `app/api/market/reddit-sentiment/route.ts` — social sentiment (Adanos Reddit + Twitter, cached 24hr)
- `lib/market/rss.ts` — RSS feed fetcher for macro news (Fed, geopolitics, commodities, jobs, government)
- `lib/ai/macro-summary.ts` — Gemini-powered per-category + cross-category macro synthesis
- `app/api/macro/news/route.ts` — macro news API (shared cache, 1hr TTL)
- `app/api/macro/preferences/route.ts` — per-user section preferences CRUD
- `app/macro/page.tsx` + `macro-dashboard.tsx` — Macro Dashboard UI with section customization
- `lib/ai/thesis.ts` — fundamentals-driven thesis generation (Gemini Flash Lite)
- `app/api/market/thesis/route.ts` — thesis API route (shared cache, 7d TTL)
- `app/api/market/earnings-detail/route.ts` — earnings detail API (shared fundamentals cache, 7d TTL)
- `lib/finance/black-scholes.ts` — Black-Scholes pricing, Greeks, IV solver
- `lib/finance/options-analysis.ts` — options signal computation (expected move, skew, max pain, etc.)
- `lib/market/yahoo-options.ts` — Yahoo Finance v7 options chain fetcher + risk-free rate
- `lib/ai/options-analysis.ts` — Gemini-powered options market narrative
- `app/api/market/options-analysis/route.ts` — options analysis API (shared cache, 4hr TTL)

## Database Tables
- `positions` — user_id, ticker, quantity, cost_basis (blended average)
- `transactions` — user_id, position_id, ticker, type, quantity, price_per_share, transacted_at
- `cache` — generic cache with jsonb data and expiry
- `watchlist` — user_id, ticker, added_at (unique per user+ticker)
- `macro_preferences` — user_id (unique), enabled_sections (text[]), updated_at — per-user section visibility

## Commands
- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run lint` — ESLint
- `npx vitest` — run tests

## Subagent Workflow
- Opus orchestrates and reviews
- Sonnet subagents implement (use `model: "sonnet"` on Agent tool)
- Update `DECISIONS.md` after each significant engineering decision
