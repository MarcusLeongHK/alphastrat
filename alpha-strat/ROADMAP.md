# AlphaStrat — Project Roadmap

A personal finance web app combining a **portfolio analyzer** (manual position entry, PnL, risk metrics, AI summaries) with a **watchlist news consolidator** (earnings calendar, Reddit/StockTwits sentiment, bull/bear/base theses, valuation screening).

Built as a single Next.js deployment with zero recurring cost as the overriding design constraint.

---

## Current Status

**Active phase: Phase 2 — Authentication & Authorization** (in progress)

| Phase | Status |
|-------|--------|
| 1. Portfolio Analyzer UI | ✅ Complete |
| 2. Authentication & Authorization | 🔵 In Progress |
| 3. Watchlist & Earnings Calendar | ⬜ Not Started |
| 4. Real-Time Dashboard Features | ⬜ Not Started |
| 5. Sentiment Analysis | ⬜ Not Started |
| 6. AI Thesis Generation | ⬜ Not Started |
| 7. Polish & Deployment | ⬜ Not Started |

**Legend:** ✅ Complete · 🔵 In Progress · ⬜ Not Started

---

## Tech Stack

- **Framework:** Next.js 16.3 (App Router, React 19, TypeScript, Tailwind CSS v4)
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Charts:** Recharts
- **Hosting:** Vercel free tier
- **Market data:** Yahoo Finance v8/v10 REST API (no Python, no `yfinance`)
- **Sentiment data:** Reddit OAuth HTTP API + StockTwits API (no PRAW, no Twitter/X)
- **AI/LLM:** Claude Haiku for portfolio summaries; Gemini/Groq free tier for thesis generation

### Constraints

- **Cost:** $0/month target — every integration must fit inside a free tier
- **Runtime:** Pure Node.js — no Python anywhere in the stack
- **Deployment:** Single Next.js app — no separate backend service

---

## Phase 1 — Portfolio Analyzer UI ✅ Complete

Manual-entry portfolio tracker with live pricing and risk analytics.

- [x] Position management — add/delete positions, buy/sell transactions with date tracking
- [x] Live quotes from Yahoo Finance v8 REST API
- [x] P&L calculations (unrealized, percentage)
- [x] Allocation pie chart (Recharts)
- [x] Risk metrics — beta, Sharpe ratio vs. SPY benchmark
- [x] Performance chart with 1M/3M/6M/1Y ranges and comparison overlay
- [x] Transaction log with expand/collapse per position
- [x] Ticker autocomplete via Yahoo Finance search API
- [x] AI portfolio summary via Claude Haiku
- [x] Generic cache layer (Supabase `jsonb` table, TTL-based)

---

## Phase 2 — Authentication & Authorization 🔵 In Progress

Move from a single-user prototype to per-user data isolation.

- [ ] Supabase Auth with email/password
- [ ] Next.js 16.3 `proxy.ts` for session refresh
- [ ] Login/signup pages
- [ ] Route protection (proxy + server-side checks)
- [ ] RLS enforcement (per-user data isolation)
- [ ] Header/nav with logout

---

## Phase 3 — Watchlist & Earnings Calendar ⬜ Not Started

Track tickers of interest independent of held positions, with earnings visibility.

- [ ] Watchlist table (user can add tickers to watch)
- [ ] Earnings calendar — upcoming earnings dates for watched tickers
- [ ] Earnings beat/miss tracking after results
- [ ] Yahoo Finance earnings endpoints for data
- [ ] Watchlist dashboard page

---

## Phase 4 — Real-Time Dashboard Features ⬜ Not Started

Bring the dashboard closer to live-market feel without paid streaming data.

- [ ] Auto-refresh quotes (polling with configurable interval)
- [ ] Real-time P&L updates
- [ ] Market status indicator (open/closed/pre-market)
- [ ] Notifications for significant price movements
- [ ] Dashboard layout improvements

---

## Phase 5 — Sentiment Analysis ⬜ Not Started

Aggregate retail sentiment signal per ticker, sourced from Reddit and StockTwits only.

- [ ] Reddit OAuth HTTP API integration (no PRAW — all Node.js `fetch`)
- [ ] StockTwits API integration
- [ ] Sentiment scoring per ticker
- [ ] Sentiment trend visualization
- [ ] Aggregate sentiment dashboard

> **Note:** Twitter/X is explicitly excluded as a sentiment source.

---

## Phase 6 — AI Thesis Generation ⬜ Not Started

LLM-generated investment framing per position, layered on top of Phase 5 sentiment data.

- [ ] Bull/bear/base case thesis for each position
- [ ] Forward-looking valuation metrics
- [ ] AI-powered risk assessment
- [ ] Comparative analysis against sector peers
- [ ] Uses LLM API (Gemini/Groq free tier keys)

---

## Phase 7 — Polish & Deployment ⬜ Not Started

Production-readiness pass before treating the app as "done."

- [ ] Responsive mobile design
- [ ] Performance optimization (lazy loading, code splitting)
- [ ] Error boundaries and graceful degradation
- [ ] SEO and meta tags
- [ ] Production Vercel deployment
- [ ] User settings page
- [ ] Export portfolio data (CSV)

---

## Related Documents

- [`DECISIONS.md`](./DECISIONS.md) — engineering decision log with options considered and tradeoffs for each major architectural choice
- [`CLAUDE.md`](./CLAUDE.md) — tech stack, architecture conventions, key file map, and commands
- [`README.md`](./README.md) — project overview
