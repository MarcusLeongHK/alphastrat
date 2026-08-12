# AlphaStrat — Engineering Decision Log

Every significant architecture and implementation decision, with the options considered, tradeoffs, and reasoning. Designed so Marcus can reference these in interviews.

---

## Decision 1: Framework — Next.js App Router vs. Alternatives

**Date:** Phase 0 (project setup)

**Options considered:**
1. **Next.js (App Router)** — React meta-framework with SSR, API routes, file-based routing
2. **Vite + React SPA** — lightweight, fast dev, but no SSR or built-in API layer
3. **Remix** — SSR-first with nested routing and data loaders
4. **Plain Express + React** — maximum control, maximum boilerplate

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Next.js App Router | Vercel free tier deploys trivially; Server Components reduce client bundle; API routes mean no separate backend; huge ecosystem | App Router is opinionated; learning curve for Server vs Client components; vendor lock-in to Vercel deployment model |
| Vite + React SPA | Fast DX; simple mental model; no SSR complexity | Need a separate API server (or serverless functions); no SSR/SEO (less relevant for a finance dashboard); CORS setup |
| Remix | Excellent data loading patterns; progressive enhancement | Smaller ecosystem; Vercel support less mature than Next.js; fewer tutorials |
| Express + React | Full control over everything | Massive boilerplate; two separate deployments; no free Vercel hosting benefit |

**Decision:** Next.js App Router

**Reasoning:** The killer feature is zero-config deployment on Vercel free tier. API routes eliminate a separate backend, keeping the project as a single deployable unit. Server Components let us fetch data server-side (Supabase queries, Yahoo Finance calls) without exposing API keys to the client. For a hobby project where cost = $0 is the target, this combination is unbeatable.

---

## Decision 2: Database — Supabase Postgres vs. Alternatives

**Date:** Phase 0

**Options considered:**
1. **Supabase (hosted Postgres + Auth + RLS)** — BaaS with a generous free tier
2. **PlanetScale (MySQL)** — serverless MySQL, good free tier
3. **Firebase (Firestore)** — NoSQL document store with auth
4. **SQLite (via Turso or local file)** — zero-ops, embedded

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Supabase | Postgres (full SQL, JSON columns, CTEs); free tier = 500MB + 2 projects; built-in Auth + RLS; real-time subscriptions; MCP tooling for Claude Code | Vendor lock-in to Supabase client; connection limits on free tier (max 60 direct) |
| PlanetScale | Serverless scaling; MySQL compatibility | No built-in auth; MySQL lacks Postgres features (jsonb, partial indexes); free tier deprecated in 2024 |
| Firebase | Real-time sync; auth built-in; generous free tier | NoSQL = no joins, denormalized data, complex queries are painful; vendor lock-in to Google; hard to migrate off |
| SQLite/Turso | Near-zero latency; simple; Turso adds replication | No built-in auth; limited concurrent write support; less ecosystem for a web app |

**Decision:** Supabase (Postgres)

**Reasoning:** Three things sealed it: (1) Postgres gives us proper relational modeling with `jsonb` for flexible cache storage — we need both structured data (positions, watchlists) and semi-structured data (cached API responses). (2) Built-in Auth with Row Level Security means auth is a database-level concern, not application-level — every query is automatically scoped to the authenticated user. (3) The MCP integration with Claude Code lets us manage the database directly during development. The free tier (500MB, 2 projects) is more than enough for a personal finance app.

---

## Decision 3: Market Data — Yahoo Finance REST API vs. Python yfinance

**Date:** Phase 1

**Options considered:**
1. **Yahoo Finance v8/v10 REST endpoints directly from Node.js** — HTTP fetch, no dependencies
2. **Python yfinance library** — popular, well-documented, wraps Yahoo's API
3. **Alpha Vantage API** — free tier with API key
4. **Polygon.io / Twelve Data** — premium market data APIs

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Yahoo Finance REST (direct) | No Python runtime needed; deploys on Vercel as-is; no API key required; free unlimited | Undocumented endpoints (reverse-engineered); could break without notice; need User-Agent spoofing |
| Python yfinance | Well-maintained library; handles edge cases; familiar API | Requires Python runtime on Vercel (separate serverless function or API); adds deployment complexity; cross-language project |
| Alpha Vantage | Documented, stable API; free tier (25 req/day) | Extremely low rate limit on free tier; 25 requests/day is unusable for a portfolio with multiple tickers |
| Polygon.io | Professional-grade data; WebSocket support | $29/mo minimum for real-time; free tier is delayed data only |

**Decision:** Yahoo Finance REST API directly from Node.js

**Reasoning:** This was one of the most impactful decisions. The original plan used Python yfinance, which would have required either: (a) a separate Python API server (doubling infrastructure), or (b) Python serverless functions on Vercel (adding deployment complexity). By calling Yahoo's v8 chart endpoint directly via `fetch()`, we eliminate Python entirely. The entire app is a single Next.js deployment. The tradeoff is fragility — these are undocumented endpoints that Yahoo could change — but for a hobby project, the simplicity of "no Python" far outweighs the stability risk. We mitigate breakage risk with our cache layer (stale data is better than no data).

---

## Decision 4: Caching Architecture — Generic Cache Table vs. Per-Entity Tables

**Date:** Phase 1

**Options considered:**
1. **Single generic cache table** with `cache_key`, `cache_type`, `data` (jsonb), `expires_at`
2. **Per-entity cache tables** — separate `price_cache`, `history_cache`, `sentiment_cache` tables
3. **In-memory cache (Redis / Upstash)** — external cache service
4. **Next.js `unstable_cache` / `revalidate`** — framework-level caching

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Generic cache table | One table, one utility function, works for any data type; `jsonb` stores anything; easy to query/debug; upsert on `cache_key` makes invalidation simple | No type safety at the DB level (jsonb is opaque); index on `cache_key` is sufficient but not specialized |
| Per-entity tables | Type-safe columns; can index specific fields; cleaner schema | N tables × N migration files; N query functions; schema changes for each new cache type; maintenance overhead |
| Redis/Upstash | Sub-millisecond reads; built for caching; TTL is native | Another service to manage; Upstash free tier has limits; adds a network hop vs. colocated Postgres; overkill for hobby project |
| Next.js cache | Zero infrastructure; built into the framework | Limited control over invalidation; tied to Vercel's caching infra; doesn't persist across deployments; opaque behavior |

**Decision:** Single generic cache table with `getOrFetch<T>()` utility

**Reasoning:** The `getOrFetch<T>(supabase, key, type, ttl, fetcher)` pattern is the backbone of cost control. One function, one table, works for prices, historical data, sentiment, theses — anything. The TypeScript generic `<T>` gives us compile-time type safety even though the DB column is `jsonb`. The `onConflict: "cache_key"` upsert means we never get duplicate entries. And because it's in Postgres (not a separate Redis), there's no additional service to manage or pay for. The tradeoff is that Postgres is slower than Redis for cache reads (~5ms vs ~1ms), but for a personal finance app checking prices every 4 hours, that difference is invisible.

---

## Decision 5: TTL Strategy — Why 4 Hours for Prices, Not Real-Time

**Date:** Phase 1

**TTL values chosen:**
- Prices: 4 hours
- Sentiment: 8 hours
- Theses: 1 week
- Earnings calendar: 24 hours

**Options considered:**
1. **Aggressive caching (4hr+ prices)** — minimize API calls, accept staleness
2. **Short TTL (5-15 min prices)** — near-real-time, many API calls
3. **No caching** — always fresh, maximum API calls
4. **Market-hours-aware caching** — short TTL during trading, long TTL after hours

**Decision:** Aggressive caching (4 hours for prices)

**Reasoning:** This is a portfolio analyzer, not a trading platform. The user isn't making split-second buy/sell decisions based on this data — they're reviewing their overall allocation, risk profile, and getting AI summaries. A price that's 2 hours old is perfectly fine for "my AAPL position is up 15% overall." The 4-hour TTL means a user checking their portfolio once a day generates at most 1 Yahoo API call per ticker. This keeps us well within any rate limits and means the app stays fast (cache hits return in ~5ms). If we later add a real-time dashboard (Phase 4), that feature will use a separate polling mechanism with shorter intervals — but the analyzer doesn't need it.

---

## Decision 6: Financial Calculations — Pure Functions vs. API-Side Computation

**Date:** Phase 1

**Options considered:**
1. **Pure functions in `lib/finance/`** — stateless, testable, imported by API routes
2. **Compute everything in the API route handler** — inline calculations
3. **Database-side computation** — Postgres functions/views for PnL, beta, etc.
4. **Client-side computation** — calculate in the browser

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Pure functions | Unit-testable with known values; reusable across routes; easy to reason about; no side effects | Extra files and imports |
| Inline in routes | Simple, everything in one place | Untestable without spinning up the full API; mixes I/O with calculation; can't reuse |
| Database-side | Offloads work to Postgres; could use materialized views | Harder to test; tightly couples logic to DB; difficult to version/debug; can't use in client |
| Client-side | Reduces server load; instant recalculation | Exposes calculation logic; inconsistent results if formulas change; can't cache results server-side |

**Decision:** Pure functions in `lib/finance/`

**Reasoning:** Financial calculations are the highest-risk code in this app — a wrong beta or Sharpe ratio silently produces misleading analysis. Pure functions (`calcBeta(stockReturns, benchmarkReturns) → number`) are trivially testable: feed in known values, assert known outputs. We wrote 16 tests covering edge cases (empty arrays, single values, NaN handling, division by zero). The API routes become thin orchestrators that fetch data and call pure functions — easy to read, easy to debug. The separation also means we can reuse `calcPnL` on both the server (for API responses) and potentially the client (for instant UI updates) without duplicating logic.

---

## Decision 7: Risk Metrics Benchmark — SPY vs. Alternatives

**Date:** Phase 1

**Options considered:**
1. **SPY (S&P 500 ETF)** — most liquid, most recognized US equity benchmark
2. **^GSPC (S&P 500 index)** — the actual index, not the ETF
3. **User-configurable benchmark** — let the user choose
4. **VTI (Total Market)** — broader US market coverage

**Decision:** SPY, hardcoded

**Reasoning:** For a Phase 1 personal finance app, SPY is the standard benchmark that every user will understand. Using the ETF (SPY) rather than the index (^GSPC) ensures Yahoo Finance data availability is consistent with how we fetch other tickers — same endpoint, same data format, same cache pattern. Making it user-configurable adds UI complexity (dropdown, validation, explanation of what benchmarks mean) for minimal Phase 1 value. We can make it configurable in Phase 7 polish if needed.

---

## Decision 8: AI Analysis — Claude Haiku with Strict Constraints

**Date:** Phase 1

**Options considered:**
1. **Claude Haiku** — cheapest Claude model, fast, good for structured analysis
2. **Claude Sonnet** — better reasoning, higher cost
3. **OpenAI GPT-4o-mini** — competitive pricing, different ecosystem
4. **No AI** — just show raw numbers

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Claude Haiku | ~$0.25/M input, $1.25/M output; fast (< 2s); good at structured summarization | Less nuanced than Sonnet for complex analysis |
| Claude Sonnet | Better reasoning for edge cases | 3x the cost; slower; overkill for 2-3 sentence summaries |
| GPT-4o-mini | Similar price/performance to Haiku | Different SDK; splitting across two AI providers adds complexity |
| No AI | Zero cost; no API dependency | Loses the key differentiator; raw numbers without context aren't actionable |

**Decision:** Claude Haiku with `max_tokens: 300` and strict system prompt

**Reasoning:** The AI summary is a 2-3 sentence portfolio description ("This is a tech-heavy, high-beta portfolio with strong recent performance..."). Haiku is perfect for this — it's fast, cheap, and follows structured instructions well. The `max_tokens: 300` cap prevents runaway costs. The system prompt explicitly forbids investment advice (legal/ethical concern) and markdown formatting (cleaner UI rendering). At ~$0.001 per summary, a user checking their portfolio daily would cost ~$0.03/month. The model ID will be updated to `claude-haiku-4-5` (current canonical alias) when we next touch this file.

---

## Decision 9: Server Actions vs. API Routes for Mutations

**Date:** Phase 1

**Options considered:**
1. **Server Actions** — React 19 / Next.js native, form-based mutations
2. **API Routes (POST)** — traditional REST endpoints
3. **tRPC** — type-safe API layer
4. **GraphQL** — schema-based API

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Server Actions | No separate API endpoint; progressive enhancement (works without JS); `useActionState` for form state; `revalidatePath` for cache invalidation; collocated with UI | New pattern, less familiar to interviewers; harder to call from non-React clients; debugging is less transparent |
| API Routes | Familiar REST pattern; easy to test with curl/Postman; works from any client | Boilerplate (route file, fetch call, error handling); manual cache invalidation; no progressive enhancement |
| tRPC | End-to-end type safety; great DX with autocomplete | Extra dependency; learning curve; overkill for simple CRUD; less familiar in interviews |
| GraphQL | Flexible querying; strong typing | Massive overhead for a simple app; resolver boilerplate; overkill |

**Decision:** Server Actions for mutations (add/delete position), API Routes for data fetching (quotes, risk metrics, AI summary)

**Reasoning:** This is a deliberate split: mutations use Server Actions because they're form-driven and benefit from progressive enhancement and `revalidatePath`. The `useActionState` hook (React 19) gives us pending states and error handling without client-side fetch boilerplate. Data fetching uses API Routes because the client components need to call them dynamically (e.g., fetching quotes for the current positions), and API routes are more natural for request/response patterns with query parameters. This split also means we can test the data-fetching routes independently with curl.

---

## Decision 10: RLS Strategy — Temporary Dev Bypass

**Date:** Phase 1

**Options considered:**
1. **Full RLS from day one** — require auth for every operation
2. **Temporary permissive policies** — open access during Phase 1, lock down in Phase 2
3. **No RLS** — disable entirely

**Decision:** Temporary permissive policies, with the real RLS policies written in the migration but overridden by dev-only open policies

**Reasoning:** The positions migration (`001_positions.sql`) includes proper user-scoped RLS policies (`auth.uid() = user_id`). But auth doesn't exist until Phase 2 — so without a logged-in user, `auth.uid()` returns null and every query fails. We added temporary "allow all" policies on the Supabase dashboard to unblock Phase 1 development. The migration file itself has the correct policies, so when Phase 2 auth is built, we just remove the dev overrides. This is explicitly a development-only shortcut — the TODO to remove them is tracked in the plan.

---

## Decision 11: Charting Library — Recharts vs. Alternatives

**Date:** Phase 1

**Options considered:**
1. **Recharts** — React-native charting, declarative API
2. **Chart.js + react-chartjs-2** — canvas-based, mature
3. **D3.js** — maximum flexibility, steep learning curve
4. **Nivo** — D3-based with React components
5. **Tremor** — pre-built dashboard components

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Recharts | Declarative React components; composable; good docs; lightweight (~40KB) | Less customizable than D3; occasional quirks with responsive sizing |
| Chart.js | Mature, well-documented, many chart types | Canvas-based (not SVG) — harder to style with CSS/Tailwind; wrapper adds complexity |
| D3.js | Can build anything; industry standard | Imperative API clashes with React's declarative model; steep learning curve; overkill for pie/bar |
| Nivo | Beautiful defaults; many chart types | Larger bundle; more opinionated; less community support |
| Tremor | Pre-built dashboard components; looks great out of the box | Opinionated design system; may conflict with our Tailwind setup; heavier |

**Decision:** Recharts

**Reasoning:** We need two charts: a pie chart (allocation) and potentially a bar chart (PnL comparison). Recharts lets us build both with JSX composition (`<PieChart><Pie data={data} /><Tooltip /></PieChart>`). It renders as SVG, which means it's styleable with Tailwind and looks sharp at any resolution. The declarative API matches React's mental model perfectly. For a hobby project that needs simple, clean charts — not a Bloomberg terminal — Recharts is the right level of abstraction.

---

## Decision 12: Error Handling Pattern — Descriptive Throws in Data Layer, Catch in Routes

**Date:** Phase 1

**Pattern:** Data-fetching functions (e.g., `getQuote`, `getHistorical`) throw descriptive errors. API route handlers catch at the top level and return structured JSON errors.

**Options considered:**
1. **Throw in data layer, catch in routes** — current approach
2. **Return Result types** — `{ data, error }` tuple from every function
3. **Error codes enum** — machine-readable error classification

**Decision:** Throw + catch

**Reasoning:** The Yahoo Finance client has 4 distinct failure modes: network failure, non-200 response, JSON parse failure, and Yahoo's own error field. Each gets a descriptive error message with the ticker name included (e.g., `Failed to reach Yahoo Finance for ticker "AAPL": network timeout`). The API route catches all of these uniformly and returns `{ error: "...", status: 500 }`. Result types would add type complexity throughout the call chain for no practical benefit — these are all exceptional cases (network down, API broken), not expected control flow. The descriptive messages make debugging straightforward without a logging service.

---

## Decision 13: Portfolio Returns Calculation — Equal-Weight Average vs. Value-Weighted

**Date:** Phase 1

**In `api/analysis/risk-metrics/route.ts`:**

**Options considered:**
1. **Equal-weight average** of daily returns across all positions
2. **Value-weighted** — weight each position's returns by its portfolio allocation

**Decision:** Equal-weight average (for now)

**Reasoning:** The risk metrics route currently computes portfolio-level beta/Sharpe/CAGR by averaging daily returns across all tickers equally. This is a simplification — a true portfolio return should weight by position size. However, the route doesn't receive position sizes (it takes `?tickers=AAPL,MSFT`). Value-weighting requires the caller to pass quantities and prices, which adds API complexity. For Phase 1, equal-weight gives a reasonable approximation. The TODO is to add position-weight parameters when the UI is wired up and can pass allocation data.

---

## Decision 14: No Python Runtime — All Node.js

**Date:** Phase 1 (architectural)

**Context:** The original CLAUDE.md mentioned yfinance (Python) for market data and PRAW (Python) for Reddit sentiment.

**Options considered:**
1. **Pure Node.js** — rewrite all data fetching as HTTP calls from Node
2. **Python sidecar** — separate Python API for yfinance/PRAW calls
3. **Python serverless functions** — Vercel supports Python functions alongside Node

**Decision:** Pure Node.js

**Reasoning:** This decision cascaded from the Yahoo Finance choice (Decision 3) and affects the entire project. Both yfinance and PRAW are Python wrappers around HTTP APIs. yfinance calls `query1.finance.yahoo.com`; PRAW calls `oauth.reddit.com`. We can make the same HTTP calls from Node.js directly. The benefit is enormous: one language, one runtime, one deployment, one `package.json`. No Python virtual environments, no cross-language type sharing, no dual CI pipelines. The cost is writing our own HTTP client code (which we did for Yahoo — ~170 lines in `lib/market/yahoo.ts`), but that's a one-time investment. For Reddit (Phase 5), the same pattern applies — `fetch()` with OAuth headers instead of PRAW's class-based API.

---

## Decision 15: Ticker Validation — Server-Side via Yahoo Finance

**Date:** Phase 1 (fix)

**Options considered:**
1. **Validate server-side by calling Yahoo Finance** — `getQuote()` in the server action before insert
2. **Client-side validation with a debounced API call** — check as user types
3. **Static ticker list** — maintain a list of valid tickers locally
4. **No validation** — let invalid tickers through, handle gracefully in the UI

**Decision:** Server-side validation via `getQuote()`

**Reasoning:** Calling `getQuote()` in the `addPosition` server action is the simplest approach that guarantees correctness — if Yahoo Finance can't return a price, the ticker is invalid. It adds a few hundred milliseconds to the add flow (one Yahoo API call), but this only happens once per new position. Client-side validation would require a new API endpoint and debounce logic for marginal UX improvement. A static list would go stale. The tradeoff is that a valid but delisted ticker might fail — acceptable for a personal finance app.

---

## Decision 16: Position vs Transaction — Single Row with Blended Cost Basis

**Date:** Phase 1 (fix)

**Options considered:**
1. **Single position row, blended cost basis on each transaction** — update existing row
2. **Separate transactions table** — store every buy/sell as its own row, compute position from aggregation
3. **Lot-based tracking** — each purchase is a separate lot (for tax-loss harvesting)

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Single row, blended | Simple schema; one row per ticker; easy to display | Loses individual transaction history; can't undo a transaction; no tax lot tracking |
| Transactions table | Full history; can replay/audit; supports sells | More complex queries (aggregate per ticker); need a view or computed field for current position; migration |
| Lot-based | Tax-optimal selling (FIFO, LIFO, specific lot); most accurate for real portfolios | Significantly more complex UI and logic; overkill for Phase 1 |

**Decision:** Single row with blended cost basis

**Reasoning:** For Phase 1, a position is "how many shares of X do I own, and what's my average cost." The blended formula `(old_qty * old_basis + new_qty * new_basis) / total_qty` gives the correct average cost per share. We lose transaction history, but the user isn't doing tax planning yet. If we add a transactions table later (Phase 7 polish or a future phase), the position row becomes a materialized view of the transaction log — the schema is forward-compatible. The key insight is that the blended cost basis is what every brokerage shows by default, so it matches user expectations.

---

## Decision 17: Ticker Autocomplete — Yahoo Finance Search API

**Date:** Phase 1 (enhancement)

**Options considered:**
1. **Yahoo Finance search endpoint** — `/v1/finance/search?q=...` returns matching symbols with company names
2. **Static list of popular tickers** — hardcoded list of top ~500 stocks
3. **No autocomplete** — user types the exact symbol

**Decision:** Yahoo Finance search endpoint via a new API route `/api/market/search`

**Reasoning:** The search endpoint is free, fast, and returns both the symbol and company name (e.g., "TSLA — Tesla, Inc."). It handles edge cases like ETFs (SPY) and international listings. A static list would miss lesser-known tickers and go stale. The implementation uses a 300ms debounce to avoid excessive API calls while typing. Results are filtered to EQUITY and ETF quote types only.

---

## Decision 18: Sell Transactions — Update Position vs Transaction Log

**Date:** Phase 1 (enhancement)

**Options considered:**
1. **Update position row in-place** — subtract shares, keep cost basis, delete row at zero
2. **Transaction log with sells** — store each sell as a negative transaction row, compute position from sum
3. **Separate sell tracking with realized P/L** — track sale price to compute gains/losses

**Decision:** Update position row in-place

**Reasoning:** Consistent with Decision 16 (single row, blended cost basis). When selling, we subtract shares and leave the average cost basis unchanged — this matches how brokerages display positions. If shares hit zero, the position is deleted entirely. We don't track realized P/L yet (would need sale price and lot matching), which is a Phase 7 or future enhancement. The tradeoff is losing sell history, but for Phase 1 the priority is "what do I own now" not "what did I trade."

---

## Decision 19: CAGR Removal — Historical Return vs Forward-Looking

**Date:** Phase 1 (fix)

**Context:** The risk metrics card showed CAGR computed from historical daily returns. Marcus questioned whether CAGR requires a reverse DCF with assumptions.

**Clarification:** The CAGR we computed (`(endValue/startValue)^(1/years) - 1`) is a legitimate historical metric — it's the annualized compound return of the portfolio over the past year. It does NOT require a DCF. However, it could be confused with forward-looking implied CAGR from a DCF model, which is a Phase 6 feature.

**Decision:** Remove CAGR from Phase 1, revisit in Phase 6 (thesis generation) where forward-looking metrics belong.

**Reasoning:** Beta and Sharpe are pure risk metrics — they describe volatility and risk-adjusted returns. CAGR is a performance metric that fits better alongside a thesis/valuation feature. Showing historical CAGR next to risk metrics could imply forward-looking projections. Better to separate concerns: risk metrics now, performance/valuation later.

---

*This log will be updated as new decisions are made in Phases 2-7.*
