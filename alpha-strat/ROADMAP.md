# AlphaStrat — Project Roadmap

A personal finance web app combining a **portfolio analyzer** (manual position entry, PnL, risk metrics, AI summaries) with a **watchlist news consolidator** (earnings calendar, Reddit/StockTwits sentiment, bull/bear/base theses, valuation screening).

Built as a single Next.js deployment with zero recurring cost as the overriding design constraint.

---

## Current Status

**Active phase: Phase 3 — Watchlist & Earnings Calendar**

| Phase | Status |
|-------|--------|
| 1. Portfolio Analyzer UI | ✅ Complete |
| 2. Authentication & Authorization | ✅ Complete |
| 3. Watchlist & Earnings Calendar | 🔵 In Progress |
| 4. Real-Time Dashboard Features | ⬜ Not Started |
| 5. Sentiment & Analyst Analysis | 🔵 In Progress |
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
- **AI/LLM:** Groq (Llama 3.3 70B) for portfolio summaries; Gemini (2.0 Flash) for thesis generation

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

## Phase 2 — Authentication & Authorization ✅ Complete

Move from a single-user prototype to per-user data isolation.

- [x] Supabase Auth with email/password
- [x] Next.js 16.3 `proxy.ts` for session refresh
- [x] Login/signup pages
- [x] Route protection (proxy + server-side checks)
- [x] RLS enforcement (per-user data isolation)
- [x] Header/nav with logout
- [x] AI provider migration (Groq + Gemini, replacing broken Anthropic SDK)
- [x] CI/CD pipeline (GitHub Actions)

---

## Phase 3 — Watchlist, Earnings & Live Dashboard 🔵 In Progress

Track tickers of interest with earnings visibility, plus live-updating dashboard features (merged from Phase 4).

- [x] Watchlist table (user can add/remove tickers to watch)
- [x] Earnings calendar — upcoming earnings dates + EPS estimates for watched tickers
- [x] Yahoo Finance earnings via quoteSummary with crumb+cookie auth
- [x] Watchlist dashboard page with live quotes, earnings, price change colors
- [x] AI summary caching (fingerprint-based, 6h TTL)
- [x] Auto-refresh quotes (60s polling, visibility-aware) — from Phase 4
- [x] Market status indicator (open/closed/pre-market) — from Phase 4
- [x] Auto-add portfolio positions to watchlist on creation
- [x] Earnings calendar visualization (3-month grid with ticker badges)
- [ ] Earnings beat/miss tracking after results

---

## Phase 4 — ~~Real-Time Dashboard Features~~ (Merged into Phase 3)

Auto-refresh and market status merged into Phase 3. Notifications and layout improvements moved to Phase 7.

- [x] Auto-refresh quotes (60s polling, visibility-aware) — merged into Phase 3
- [x] Real-time P&L updates (derived from auto-refreshed quotes) — merged into Phase 3
- [x] Market status indicator (open/closed/pre-market) — merged into Phase 3
- [ ] Notifications for significant price movements — moved to Phase 7
- [ ] Dashboard layout improvements — moved to Phase 7

---

## Phase 5 — Sentiment & Analyst Analysis 🔵 In Progress

Dual-lens view: retail sentiment from social media vs. Wall Street analyst consensus. Plus AI-summarized news per ticker.

**Analyst data (from Yahoo Finance):**
- [x] Analyst ratings (buy/hold/sell distribution, consensus recommendation)
- [x] Price targets (mean, high, low, number of analysts)
- [ ] Analyst vs. sentiment comparison visualization

**Social media sentiment:**
- [ ] Reddit OAuth HTTP API integration (no PRAW — all Node.js `fetch`)
- [ ] StockTwits API integration
- [ ] Sentiment scoring per ticker
- [ ] Sentiment trend visualization

**News summaries:**
- [ ] Aggregate recent news articles per watchlist ticker (Yahoo Finance news or free news API)
- [ ] AI-generated summary of most relevant/recent articles per ticker (via Gemini)
- [ ] News feed in watchlist ticker detail view

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
