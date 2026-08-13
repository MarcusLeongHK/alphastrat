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
- Reddit OAuth HTTP API for sentiment (no PRAW) — Phase 5
- Generic cache utility: `lib/cache/index.ts` → `getOrFetch<T>()`
- Cache table with `cache_key`, `cache_type`, `data` (jsonb), `expires_at`
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
- `lib/ai/client.ts` — dual-provider AI client (Groq for summaries, Gemini for thesis)
- `lib/ai/prompts.ts` — system prompts and prompt builders

## Database Tables
- `positions` — user_id, ticker, quantity, cost_basis (blended average)
- `transactions` — user_id, position_id, ticker, type, quantity, price_per_share, transacted_at
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
