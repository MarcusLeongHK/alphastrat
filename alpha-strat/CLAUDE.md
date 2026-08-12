@AGENTS.md

# AlphaStrat — Personal Finance Web App

## Tech Stack
- Next.js (App Router, TypeScript, Tailwind CSS v4)
- Supabase (Auth + Postgres database)
- Deployed on Vercel free tier
- Cost control is a priority — hobby project, not commercial

## Architecture Decisions

### Data & Caching
- Analysis runs on-demand with cache-freshness checks, NOT scheduled cron jobs
- Always check whether cached data is still fresh before triggering a new scrape or LLM call
- Freshness targets: prices/fundamentals = trading day, sentiment = 4-12 hours, bull/bear/base thesis = ~1 week
- Auth required on all user-scoped data (positions, watchlists) via Supabase Auth

### LLM Usage
- Use Claude Haiku for routine sentiment scoring and analysis calls (~$0-5/month target)
- Only use a stronger model if explicitly asked

### Sentiment Sources
- Reddit (via PRAW) and StockTwits ONLY for sentiment
- NO Twitter/X scraping or API (decided against due to cost and fragility)
- NO TradingView integration (no viable third-party data API — manual ticker entry only)

### Market Data
- yfinance for market data and earnings calendar
- Manual ticker entry for portfolio positions (no brokerage import)

## Features (Build Order)
1. Portfolio analyzer core (manual entry, PnL, allocation chart, risk metrics, AI style/risk summary)
2. Auth layer (Supabase Auth, scope all data to users)
3. Watchlist + market data (yfinance) + earnings calendar + caching layer
4. Real-time PnL dashboard (websocket/polling — architecturally distinct phase)
5. Sentiment pipeline (Reddit + StockTwits, Haiku summarization)
6. Bull/bear/base thesis generation + valuation screening
7. Remaining test coverage and polish

## Testing
- Write tests for financial calculations (PnL, beta, Sharpe ratio, CAGR) as each one is built
- These are silent-failure prone — verify against known values, don't defer

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run lint` — run ESLint
