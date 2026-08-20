# AlphaStrat

A personal finance web app for portfolio analysis, market research, and options analytics.

Built with Next.js 16, React 19, Supabase, and Tailwind CSS v4.

> **Access-controlled** — signup requires an invite code.

<!-- 
  Add screenshots: place images in a `docs/images/` directory and uncomment the lines below.
  Recommended screenshots:
  1. Watchlist overview (desktop)
  2. Ticker detail panel with chart
  3. Options tab with expected move gauge
  4. Portfolio dashboard
  5. Macro dashboard
  6. Mobile view (watchlist or portfolio)
-->

<!-- ![Watchlist](docs/images/watchlist.png) -->

---

## Features

### Watchlist & Ticker Research
- Real-time quotes via Yahoo Finance
- Interactive price charts (1D to 5Y)
- AI-generated investment thesis with bull/bear cases (Gemini Flash Lite)
- News aggregation with AI-summarized themes (Groq)
- Analyst ratings and price targets
- Social sentiment analysis via Adanos (Reddit + Twitter/X)

### Options Analytics
- Expected move gauge with max pain overlay
- IV surface, term structure, and positioning-by-strike charts
- Greeks computed via Black-Scholes
- Unusual activity detection (volume/OI > 2x)
- AI narrative summary of options flow
- [In-app educational guide](/guide/options) explaining every metric

### Portfolio Dashboard
- Position tracking with blended cost basis
- P&L calculation (unrealized + realized)
- Allocation breakdown by sector and ticker
- Risk metrics: beta, Sharpe ratio, max drawdown (vs. SPY benchmark)
- Performance chart with benchmark comparison

### Macro Dashboard
- RSS-sourced news across Fed policy, geopolitics, commodities, jobs, and government
- AI-synthesized market outlook with sentiment badges and driver chips (Gemini)
- Customizable section visibility per user

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.3 (App Router) |
| UI | React 19, Tailwind CSS v4, Recharts |
| Auth | Supabase Auth (email/password, `@supabase/ssr`) |
| Database | Supabase Postgres with Row-Level Security |
| AI | Groq (Llama 3 — summaries, sentiment), Gemini Flash Lite (thesis, options, macro) |
| Market Data | Yahoo Finance REST (v8/v10), Adanos API (social sentiment) |
| Deployment | Vercel (free tier) |
| Caching | Supabase-backed generic cache (`getOrFetch<T>()`) with per-type TTLs |

---

## Architecture Highlights

- **No Python, no heavy SDKs** — all data fetching via direct `fetch()` calls to REST APIs
- **Generic cache utility** — `lib/cache/index.ts` provides `getOrFetch<T>()` with composite upsert, user-scoped or shared cache modes
- **Pure financial calculations** — `lib/finance/` contains unit-tested functions for P&L, risk metrics, Black-Scholes, allocation
- **Design token system** — CSS custom properties (`--surface-primary`, `--text-primary`, etc.) for consistent theming
- **Server Actions** for mutations, **API Routes** for data fetching
- **Proxy-based auth** (Next.js 16 `proxy.ts`) for session refresh and route protection

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project
- API keys for: Groq, Gemini, Adanos (optional)

### Setup

```bash
git clone https://github.com/MarcusLeongHK/alphastrat.git
cd alphastrat
npm install
```

Create a `.env` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
GROQ_API_KEY=your_groq_key
GEMINI_API_KEY=your_gemini_key
ADANOS_API_KEY=your_adanos_key
```

Apply database migrations (in order):

```bash
# Run each .sql file in supabase/migrations/ against your Supabase project
# via the Supabase dashboard SQL editor or CLI
```

### Development

```bash
npm run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (port 3000) |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npx vitest` | Run tests |

---

## Project Structure

```
app/
  page.tsx                    # Landing page
  login/                      # Auth pages
  signup/
  watchlist/                  # Watchlist + ticker detail panel
    tabs/                     # Per-tab components (overview, news, sentiment, thesis, earnings, options)
  portfolio/                  # Portfolio dashboard
  macro/                      # Macro news dashboard
  guide/options/              # Options analytics educational guide
  components/                 # Shared UI (Header, MobileNav, Card, Badge, etc.)
  api/                        # API routes (market data, analysis, watchlist, macro)
lib/
  finance/                    # Pure calculation functions (pnl, risk, allocation, black-scholes)
  market/                     # Data fetchers (Yahoo Finance, Adanos, RSS)
  ai/                         # AI modules (thesis, news summary, options analysis, macro summary)
  cache/                      # Generic cache utility
  supabase/                   # Supabase client setup
supabase/
  migrations/                 # SQL migration files
```

---

## License

Private project. All rights reserved.
