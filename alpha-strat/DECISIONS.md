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

## Decision 20: Transaction Log — Client-Side Fetch vs Server Component

**Date:** Phase 1 (transaction history)

**Options considered:**
1. **Server Component with async data** — fetch transactions server-side, pass as props
2. **Client-side fetch on expand** — lazy-load transactions via API route when user clicks to expand
3. **Preload all transactions with positions** — single query joins positions + transactions

**Decision:** Client-side fetch on expand

**Reasoning:** Transaction history is a secondary concern — most users look at positions and PnL, not individual trades. Loading transactions for all positions upfront wastes bandwidth and slows initial page load. Server Components can't be conditionally rendered inside client interactive components (the expand/collapse is client state). The API route (`/api/portfolio/transactions?position_id=X`) keeps the data fetch lazy and the component self-contained. A `refreshKey` prop triggers re-fetch after new transactions are added while the log is expanded.

---

## Decision 21: Sell-to-Zero — Delete vs Preserve Position

**Date:** Phase 1 (sell transactions)

**Options considered:**
1. **Delete position at zero shares** — cascade deletes transactions, clean positions table
2. **Keep position with quantity=0** — mark as "Closed", preserve all transaction history
3. **Soft delete with a `closed_at` timestamp** — filter from active view but keep data

**Decision:** Keep position with quantity=0, show "Closed" badge

**Reasoning:** Transaction history is the primary value of the transaction log feature. Deleting the position cascades to delete all transactions (per the foreign key), destroying the user's trade history. Keeping zero-quantity positions with muted styling and a "Closed" badge preserves history while clearly distinguishing active from closed positions. The positions table constraint was relaxed from `quantity > 0` to `quantity >= 0`. The explicit "Delete" button still exists for intentional cleanup — that cascade-deletes transactions by design, since the user is explicitly choosing to remove all data.

---

## Decision 22: Performance Chart — Normalized Returns vs Absolute Price

**Date:** Phase 1 (portfolio performance)

**Options considered:**
1. **Absolute price chart** — show portfolio dollar value over time
2. **Normalized percentage returns** — show % change from day 0 for portfolio and comparisons
3. **Indexed to 100** — normalize all series to start at 100

**Decision:** Normalized percentage returns

**Reasoning:** The chart's primary use case is comparing portfolio performance against benchmarks (SPY, QQQ) and individual stocks. Absolute prices are incomparable — SPY at $500 vs AAPL at $300 tells you nothing. Normalizing to percentage returns from a common start date makes apples-to-apples comparison possible. The Y-axis shows "-20%", "20%", "40%" etc., making it immediately clear which investment outperformed. This is the same approach used by Google Finance, Yahoo Finance, and professional portfolio tools. Indexing to 100 is equivalent mathematically but percentage returns are more intuitive for retail investors.

---

## Decision 23: Transaction Table user_id — NOT NULL vs Nullable Pre-Auth

**Date:** Phase 1 (bug fix)

**Context:** Transaction inserts were silently failing because the `user_id` column defaulted to `auth.uid()` (null without auth) but had a `NOT NULL` constraint.

**Options considered:**
1. **Make user_id nullable** — match positions table approach, fix in Phase 2 auth
2. **Hard-code a dev UUID** — insert a fake user_id for development
3. **Set up auth first** — prioritize Phase 2 to unblock transactions

**Decision:** Make user_id nullable, matching the positions table

**Reasoning:** Positions already use nullable user_id as a temporary dev bypass. Consistency matters — having one table nullable and another NOT NULL creates confusing silent failures (the insert returns no error via Supabase client, it just doesn't insert). Phase 2 auth will enforce `NOT NULL` on both tables simultaneously. The alternative of hard-coding a UUID would require cleanup later and doesn't match the existing pattern.

---

## Decision 24: Optional Transaction Date — Native Calendar vs Date Picker Library

**Date:** Phase 1 (enhancement)

**Options considered:**
1. **Native HTML `<input type="date">`** — built-in calendar picker, zero dependencies
2. **React date picker library (react-datepicker, react-day-picker)** — richer UI, more customization
3. **No date field** — always use current date

**Decision:** Native HTML date input

**Reasoning:** The native date input provides a calendar picker in all modern browsers with zero bundle size cost. A library like react-datepicker adds ~30KB gzipped and introduces a dependency to maintain. The field is optional — defaults to the DB's `now()` when left blank. We cap `max` to today's date to prevent future-dated transactions. For a personal finance app where you're occasionally backdating a trade you forgot to log, the native picker is sufficient. If we needed date ranges, time selection, or complex validation, a library would be worth it.

---

## Decision 25: Performance Chart Date Range — Full History vs Transaction-Bounded

**Date:** Phase 1 (bug fix)

**Context:** The 1Y chart showed data from a year ago even though no positions existed back then, creating misleading flat lines before the first transaction.

**Options considered:**
1. **Full historical range** — always show the complete range (1M/3M/6M/1Y from today)
2. **Start from earliest transaction date** — query `transactions` table for the earliest `transacted_at`
3. **Start from position `created_at`** — use the positions table timestamp

**Decision:** Start from the earliest transaction date, fall back to full range if no transactions exist

**Reasoning:** The chart should reflect the period the portfolio actually existed. Showing returns before any positions were held is meaningless — you'd see flat lines or misleading jumps when the first purchase appears. Querying `MIN(transacted_at)` from the transactions table gives the true portfolio inception date. The fallback handles legacy positions created before the transactions feature was added (they have no transaction rows). Using `positions.created_at` would work but is less precise — a user might backdate a transaction to when they actually bought it.

---

## Decision 26: Yahoo Finance Range Parameter Mapping

**Date:** Phase 1 (bug fix)

**Context:** The 1M, 3M, and 6M performance chart ranges returned only 1 data point. The frontend passed `1m`, `3m`, `6m` but Yahoo Finance v8 API expects `1mo`, `3mo`, `6mo`. Only `1y` happened to match.

**Fix:** Added a `RANGE_TO_YAHOO` mapping in the performance API route that converts frontend range values (`1m` → `1mo`, `3m` → `3mo`, `6m` → `6mo`, `1y` → `1y`) before passing to `getHistorical()`. The cache key still uses the frontend format for consistency.

**Lesson:** When wrapping a third-party API, validate the parameter contract early — "looks right" doesn't mean "is right." Yahoo's range parameter silently returns minimal data for unrecognized values rather than erroring, making this easy to miss.

---

## Decision 27: Auth Strategy — Proxy Redirect vs authInterrupts

**Date:** Phase 2

**Options considered:**
1. **Proxy redirect to /login** — standard pattern, redirect unauthenticated users from protected routes
2. **authInterrupts (experimental)** — Next.js 16.3 feature enabling `unauthorized()` / `forbidden()` calls that render dedicated 401/403 pages with correct HTTP status codes

**Decision:** Proxy redirect

**Reasoning:** `authInterrupts` is still marked experimental in Next.js 16.3. For a hobby project, the stable redirect pattern is simpler and well-documented. The proxy redirects unauthenticated users to `/login` for page routes and returns JSON `{ error: "Unauthorized" }` with 401 status for API routes. If `authInterrupts` graduates to stable, it could be adopted later for a cleaner separation of auth errors (401 vs 403).

---

## Decision 28: JWT Verification Strategy — getClaims() vs getUser()

**Date:** Phase 2

**Context:** Supabase offers three methods to verify auth: `getSession()` (unsafe, reads cookie without verification), `getClaims()` (verifies JWT signature locally using JWKS), `getUser()` (round-trip to Supabase auth server).

**Decision:** Use `getUser()` for mutations and page-level auth; use `getClaims()` for API route read protection.

**Reasoning:** Server Actions that modify data (addPosition, addTransaction, deletePosition) warrant the strongest verification — `getUser()` confirms the session is still valid on the auth server, catching revoked sessions. API routes called frequently from client components (quotes, chart data, risk metrics) use `getClaims()` which verifies the JWT locally without a network round-trip. This is faster and reduces load on Supabase's free tier. The proxy uses `getUser()` because it runs once per navigation and also triggers token refresh.

---

## Decision 29: Dev Data Migration — Assign to First User vs Delete

**Date:** Phase 2

**Options considered:**
1. **Assign all NULL user_id rows to the first registered user** — preserve Phase 1 test data
2. **Delete all NULL user_id rows** — clean slate
3. **Leave NULL rows** — they become invisible under RLS anyway

**Decision:** Assign to first user via manual SQL after signup

**Reasoning:** Marcus entered real positions and transactions during Phase 1 development. Deleting them would require re-entering everything. Leaving NULL rows makes them invisible but wastes storage. Assigning them to the first user (via `UPDATE positions SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL`) preserves all data and is a one-time operation run from the Supabase SQL editor after the first signup. The commented-out SQL is in `003_auth_rls.sql` for reference.

---

## Decision 30: AI Provider — Groq + Gemini vs Single Provider

**Date:** Phase 2

**Options considered:**
1. **Groq only** (Llama 3.3 70B) — fast, OpenAI-compatible API, generous free tier (30 RPM)
2. **Gemini only** (Gemini 2.0 Flash) — good reasoning, 15 RPM / 1M tokens/day free
3. **Dual provider: Groq for short tasks, Gemini for long tasks** — task-matched selection
4. **Anthropic SDK** (original implementation) — `@anthropic-ai/sdk` was imported but never installed

**Decision:** Dual provider with Groq as default

**Reasoning:** Different AI tasks have different latency/quality profiles. Portfolio summaries (2-3 sentences) need speed over depth — Groq's ~200ms inference on Llama 3.3 70B is ideal and the 30 RPM free tier is generous. Thesis generation (Phase 6) needs stronger analytical reasoning over longer output — Gemini 2.0 Flash is better suited with its 1M tokens/day free tier. Using direct `fetch()` to REST APIs avoids adding SDK dependencies, consistent with the project's "no heavy libraries" pattern. The provider abstraction in `lib/ai/client.ts` makes switching trivial — `generateCompletion(system, user, "gemini")`.

---

## Decision 31: RLS Policy Fix — Permissive Dev Policies to Per-User Isolation

**Date:** Phase 2

**Context:** Both accounts saw the same portfolio data because of three compounding issues.

**Root causes fixed:**
1. **RLS policies** used `qual = true` (the `dev_*` policies from Phase 1) — every authenticated user could read/write all rows
2. **Server actions** never set `user_id` on inserts — all new data had NULL user_id
3. **All existing data** had `user_id = NULL` — no ownership assigned

**Fix applied:**
- Dropped all 6 permissive dev policies, created 8 proper policies with `auth.uid() = user_id` (SELECT/INSERT/UPDATE/DELETE on both positions and transactions)
- Added `user_id = user.id` to all insert operations in `addPosition` and `addTransaction`
- Added `user_id` to duplicate-ticker check (`.eq("user_id", user.id)`) so different users can hold the same ticker
- Assigned NULL rows to primary account, enforced `NOT NULL` on `user_id` for both tables
- Added `user_id` to `PositionInsert` type

---

## Decision 32: Yahoo Finance Earnings — Crumb+Cookie Auth

**Date:** Phase 3

**Context:** The `getEarnings()` function used Yahoo's `v10/finance/quoteSummary` endpoint to fetch earnings dates and EPS estimates. It returned all nulls in production.

**Root cause:** Yahoo's quoteSummary v10 endpoint now requires a `crumb` token + session cookie for authentication. Without it, the endpoint returns HTTP 401. The v8 chart endpoint (used for quotes and historical data) still works without auth.

**Options considered:**
1. **Crumb+cookie workflow** — Fetch cookie from `fc.yahoo.com`, get crumb from `query2.finance.yahoo.com/v1/test/getcrumb`, pass both on quoteSummary requests
2. **Alternative data source** — Use a different free API for earnings data
3. **Scrape from Yahoo Finance HTML** — Parse earnings from the quote page

**Decision:** Crumb+cookie workflow with in-memory caching

**Reasoning:** The crumb+cookie approach is well-documented and reliable. The crumb is cached in-memory for 1 hour to avoid redundant auth requests. Since earnings data is already cached via `getOrFetch` with `EARNINGS_TTL` (24 hours), the crumb overhead is minimal — at most one auth round-trip per server restart. Alternative APIs either cost money or have worse data quality.

---

## Decision 33: Merge Phase 4 into Phase 3 — Eliminate Standalone Phase

**Date:** Phase 3

**Context:** Phase 4 ("Real-Time Dashboard Features") planned: auto-refresh quotes, real-time P&L updates, market status indicator, price movement notifications, dashboard layout improvements.

**Analysis:** Most Phase 4 items are thin:
- Auto-refresh → a `setInterval` on existing quote fetching, plus visibility-aware pausing
- P&L updates → free once quotes auto-refresh (P&L derives from quotes)
- Market status → a small time-based component (~50 lines)
- Notifications → the only substantial new feature
- Layout improvements → subjective, fits Phase 7 polish

**Decision:** Merge auto-refresh + market status into Phase 3. Move notifications and layout improvements to Phase 7.

**Reasoning:** Keeping Phase 4 as a standalone phase adds overhead (planning, context-switching, documentation) for ~2 hours of work. Folding the meaningful features into Phase 3 keeps the project moving. Notifications and layout polish are better bundled with Phase 7's production-readiness pass where they'll be considered holistically.

---

## Decision 34: Expandable Row Detail vs. Slide-Out Panel vs. Separate Page

**Date:** Phase 5

**Options considered:**
1. **Expandable row** — click a watchlist row to reveal a detail panel inline below it
2. **Slide-out drawer** — click to open a side panel with details
3. **Separate page** — `/watchlist/AAPL` with full-page detail view
4. **Modal/dialog** — overlay with stock details

**Decision:** Expandable row with `React.Fragment` wrapping each table row + detail row

**Reasoning:** The user explicitly requested "more information shown when I click on it in the watchlist." An expandable row keeps context — you see the detail panel right below the ticker you clicked, with the rest of the watchlist still visible for comparison. A separate page loses context; a modal blocks the background; a drawer works but feels like a different app paradigm. The `React.Fragment` pattern lets us render two `<tr>` elements (data row + detail row) per item without breaking table semantics. The arrow indicator (▶) rotates 90° when expanded for visual feedback.

---

## Decision 35: News Display — Cited AI Summary vs. Article List

**Date:** Phase 5

**Options considered:**
1. **Article list** — show individual headlines with publisher and timestamp
2. **AI summary + article list** — summary at top, full list below
3. **Cited AI summary** — AI writes a cohesive summary with inline `[1]`, `[2]` citations linking to source articles

**Decision:** Cited AI summary with numbered source references

**Reasoning:** A raw article list requires the user to scan 8+ headlines to understand what's happening. A plain AI summary loses source attribution. The cited format gives the best of both: a readable 2-4 sentence narrative with inline bracket citations (`[1]`, `[2]`) that link directly to the original articles. Below the summary, a compact "Sources" section lists all articles by number for reference. The AI prompt instructs Gemini to use `[N]` notation matching article numbers, and the frontend parses these with a regex split to render them as clickable links. This is the same citation pattern used by research tools like Perplexity.

---

## Decision 36: Sentiment Data Sources — StockTwits + Analyst Comparison

**Date:** Phase 5

**Options considered:**
1. **Reddit (r/wallstreetbets, r/stocks)** — largest retail investor community
2. **StockTwits** — dedicated stock social network, public API
3. **Twitter/X** — broad sentiment, requires paid API
4. **Multiple sources aggregated** — combine Reddit + StockTwits

**Decision:** StockTwits as primary retail sentiment, with analyst vs. retail comparison

**Reasoning:** StockTwits has a public, free API that returns per-ticker sentiment (bullish/bearish message counts) without authentication. Reddit's API requires OAuth app registration (additional setup burden). Twitter's API is paid. StockTwits data maps directly to what we need: "are retail investors bullish or bearish on this ticker?" The analyst vs. retail comparison panel highlights divergences — when Wall Street says "Strong Buy" but retail is bearish (or vice versa), that's a signal worth surfacing. StockTwits may be rate-limited in some environments — the client fails soft to null values so the UI gracefully shows "No sentiment data available."

---

## Decision 37: Gemini Model — Latest Rolling Alias vs. Pinned Version

**Date:** Phase 5

**Context:** The original `gemini-2.0-flash` model was deprecated by Google, breaking AI news summaries.

**Options considered:**
1. **Pin to a specific model** (e.g., `gemini-3.6-flash`) — stable but requires manual updates
2. **Use rolling alias** (`gemini-flash-latest`) — always resolves to newest Flash model
3. **Switch to a different provider** — use Groq for everything

**Decision:** Rolling alias `gemini-flash-latest`

**Reasoning:** Google deprecates Gemini models frequently — pinning to a specific version means the app breaks silently when that version is removed (as happened with `gemini-2.0-flash`). The rolling alias ensures we're always on the latest Flash model without code changes. The tradeoff is that output quality/format could change between model versions, but for news summarization the risk is low. Groq (Llama 3.3 70B) remains the default for portfolio summaries where we've tuned the prompt.

## Decision 38: Reddit Sentiment — RSS Multi-Subreddit Search vs. JSON API vs. OAuth

**Date:** Phase 5 (2026-08-13)

**Context:** The original plan called for Reddit OAuth via PRAW (Python) or direct JSON API. Both approaches failed: Reddit's JSON endpoints (`reddit.com/r/…/.json`) return HTML instead of JSON for server-side requests, and the app registration flow at `reddit.com/prefs/apps` now redirects to Devvit (Reddit's platform for Reddit-native apps, not for external API consumers). StockTwits API returns 403 behind Cloudflare bot protection.

**Options considered:**
1. **Reddit OAuth API** — proper API access via client_id + secret
2. **Reddit JSON endpoints** — unauthenticated `.json` suffix on any Reddit URL
3. **Reddit RSS feeds** — Atom XML from `.rss` suffix on search/subreddit URLs
4. **PRAW (Python)** — official Reddit Python library
5. **Third-party archives** (Pullpush, Arctic Shift) — historical Reddit data APIs
6. **Twitter/X API** — social sentiment from tweets

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Reddit OAuth | Full API access, reliable | Registration flow broken (redirects to Devvit); requires form submission for API key access |
| Reddit JSON | No auth needed; same data as API | Returns HTML, not JSON, for server-side requests — blocked by bot detection |
| Reddit RSS | No auth needed; returns real data; single HTTP request | No upvote scores (always 0); limited to ~25 results; Atom XML requires parsing |
| PRAW | Well-maintained; handles OAuth automatically | Requires Python runtime (violates Decision 14); still needs API credentials we can't obtain |
| Third-party archives | Historical data; no rate limits | Services are down/timing out (Pullpush, Arctic Shift) as of Aug 2026 |
| Twitter/X API | Largest social platform | $100/month minimum; Nitter proxies blocked by Cloudflare |

**Decision:** Reddit RSS feeds with multi-subreddit search path

**Implementation details:**
- URL pattern: `https://www.reddit.com/r/wallstreetbets+stocks+investing+options+stockmarket/search.rss?q=TICKER&sort=hot&t=week&restrict_sr=on&limit=25`
- The `+` syntax searches across 5 finance subreddits in a single HTTP request (no rate limit risk from multiple calls)
- `sort=hot` returns currently trending discussions (better for real-time sentiment than `relevance`)
- `restrict_sr=on` ensures results come only from the specified subreddits (avoids false positives like r/Blind where NVDA is a screen reader)
- Subreddit extracted from each post's permalink via regex (not hardcoded) since results span multiple subs
- `rss-parser` npm package handles Atom XML parsing robustly
- Results cached for 8 hours via `getOrFetch` to minimize Reddit requests (1 API call per ticker per 8 hours)
- Fetch is lazy — only triggered when user clicks the Sentiment tab, not on component mount

**Reasoning:** RSS is the only Reddit access method that works reliably from server-side Node.js without authentication. The tradeoff is losing upvote scores (RSS returns 0 for all posts), but the post titles and content are sufficient for AI sentiment analysis. The multi-subreddit `+` path was chosen over Reddit-wide search because unrestricted search returns irrelevant results (e.g., NVDA matching the screen reader subreddit). Five finance-focused subreddits provide broad retail sentiment coverage while keeping results relevant.

---

## Decision 39: Reddit Sentiment AI — Groq vs. Gemini

**Date:** Phase 5 (2026-08-13)

**Options considered:**
1. **Groq (Llama 3.3 70B)** — fast inference (~200ms), good at short analytical text
2. **Gemini Flash** — good reasoning, rolling alias avoids deprecation

**Decision:** Groq for Reddit sentiment analysis AND retail-vs-institutional comparison

**Reasoning:** Both the Reddit sentiment summary and the retail-vs-institutional comparison are short-form analytical text (2-4 sentences each). Groq's ~200ms inference on Llama 3.3 70B is ideal for this — fast enough that the Sentiment tab feels responsive even with two sequential AI calls. Gemini is reserved for longer-form analysis (thesis generation in Phase 6) where deeper reasoning justifies the slower response. The dual-AI architecture from Decision 30 pays off here: task-matched model selection keeps the UX snappy for lightweight analysis while preserving capacity for heavyweight tasks.

---

## Decision 40: Retail vs. Institutional Comparison — AI-Generated vs. Rule-Based

**Date:** Phase 5 (2026-08-13)

**Options considered:**
1. **AI-generated comparison** — Groq analyzes both signals and writes a natural-language comparison
2. **Rule-based** — programmatic logic (if analyst=buy AND reddit=bearish → "Divergence detected")
3. **Side-by-side display only** — show both without explicit comparison

**Decision:** AI-generated comparison via Groq

**Reasoning:** The value of comparing retail vs. institutional sentiment is in the nuance — not just "they agree" or "they disagree" but *why* and *what it means*. A rule-based system would need to categorize Reddit sentiment into buckets (bullish/bearish/neutral), losing the subtlety of mixed signals. The AI reads the analyst consensus rating, analyst count, and the full Reddit sentiment summary, then writes 2-3 sentences identifying congruence or divergence with context. This produces insights like "both groups are bullish but retail is more speculative, focused on short-term price targets while analysts cite fundamentals." Cost is negligible — one additional Groq call per ticker per 8 hours (cached).

## Decision 41: New Phase — Macro News Dashboard (Next Up)

**Date:** Roadmap update (2026-08-14)

**Context:** Portfolio and watchlist features so far are ticker-specific (quotes, earnings, analyst ratings, sentiment). There's no dedicated view for market-wide macro context — the kind of news that moves everything at once regardless of which stocks are held.

**Scope:**
- A dedicated page covering macro market news, separate from the per-ticker watchlist/news views
- Geopolitics coverage (wars, elections, trade disputes, sanctions)
- Commodities: oil, metals, and food prices/news
- Unemployment data and other labor market releases
- Federal Reserve announcements (rate decisions, FOMC minutes, Fed speak)
- US national news from the Fed and US government relating to equities broadly (fiscal policy, regulation, economic data releases)

**Decision:** This is the next phase to implement, placed before the thesis-generation phase in the roadmap.

**Reasoning:** Macro context is a prerequisite for good thesis quality (feedback_thesis_quality.md requires institutional-investor-level bull/bear cases) — an institutional-grade thesis needs to reference the macro backdrop (rate environment, commodity costs, geopolitical risk), so building this dashboard first gives the thesis phase real inputs to draw from rather than requiring it to be bolted on later. It also reuses existing infrastructure (Decision 35's cited AI summary pattern, the cache layer, and the dual AI provider setup) rather than requiring new architecture.

---

## Decision 42: Adanos as Primary Sentiment Source — Multi-Source Integration

**Date:** Phase 5 (2026-08-14)

**Context:** Following Decision 38 (Reddit RSS) and the discovery that StockTwits and Reddit's public/OAuth APIs are increasingly blocked (see `project_api_blocks.md`), a broader sentiment aggregation approach was needed. Adanos provides a single API surface covering multiple sentiment sources.

**Options considered:**
1. **Adanos (multi-source aggregator)** — single API covering Reddit, Twitter/X, News, and Polymarket sentiment
2. **Separate APIs per platform** — maintain individual clients for Reddit RSS, a Twitter/X source, a news API, and a prediction-market API
3. **Paid tier of a single provider** — pay for higher rate limits on one aggregator instead of managing multiple free keys

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| Adanos (multi-source) | One API, one client, one auth pattern for 4 sentiment sources; free tier usable with multiple keys; consistent response shape | Free tier capped at 250 requests/key/month — needs round-robin across keys; dependency on a single third-party aggregator |
| Separate APIs per platform | No single point of failure; each source can be swapped independently | 4x the client code, 4x the failure modes, 4x the auth/rate-limit handling; Reddit/StockTwits already proven unreliable (Decision 38) |
| Paid tier | Higher limits, no key juggling | Violates the $0 cost-control constraint that governs every other decision in this project |

**Decision:** Adanos as the primary sentiment source across Reddit, Twitter/X, News, and Polymarket, using multiple API keys in round-robin to stay within the free tier (250 requests/key/month), with a 24-hour cache TTL to minimize API calls.

**Reasoning:** A single API covering all four social/sentiment sources collapses what would otherwise be four separate integrations (each with its own auth quirks and blocking risk, as seen with StockTwits' Cloudflare block and Reddit's broken OAuth registration flow) into one client and one failure mode to handle. The free tier's 250 req/key/month limit is workable because sentiment data doesn't need to be fresher than daily for a portfolio-review use case — a 24-hour cache TTL (longer than the 8-hour TTL used for Reddit RSS in Decision 39, since Adanos aggregates and update frequency is coarser) combined with round-robin across multiple free keys keeps the app fully within Adanos's free tier at $0 cost, consistent with every prior AI/data-source decision in this log.

---

## Decision 43: Future Phase — Options Market Analysis

**Date:** Roadmap update (2026-08-14)

**Context:** Options market activity (flow, open interest, implied volatility) often reflects informed positioning ahead of price moves — a signal not captured by any current feature (price data, sentiment, analyst ratings, news).

**Scope (not yet implemented — needs brainstorming in a future phase):**
- Core question the feature should answer: "What story does the options market tell about this stock?"
- Candidate angles: options flow, unusual options activity, put/call ratios, implied volatility skew

**Decision:** Placed as a future phase, after the thesis-generation phase in the roadmap. Not being implemented now.

**Reasoning:** Options data sourcing and interpretation is materially more complex than anything built so far — it needs its own brainstorming pass (per the `superpowers:brainstorming` workflow) to scope a free/low-cost data source and decide which signals (flow vs. skew vs. put/call ratio) are worth surfacing before any implementation planning begins. Sequencing it after the thesis phase keeps the roadmap focused: thesis generation is the current differentiator to finish, and options analysis is a stretch feature layered on top once the core analyzer is complete.

---

## Decision 44: Future Feature — Crypto Dashboard

**Date:** Roadmap update (2026-08-14)

**Context:** All current features (portfolio, watchlist, sentiment, news) are equities-focused. Crypto assets have different data sources, different market structure (24/7 trading, no earnings/analyst coverage), and arguably belong in a separate part of the app rather than bolted onto equity-oriented views.

**Scope:**
- A crypto-specific page focused solely on crypto-related assets, separate from the equities-focused portfolio/watchlist/thesis features

**Decision:** Far-future feature, explicitly not part of the current development roadmap (not sequenced relative to the Macro News Dashboard or Options Market Analysis phases).

**Reasoning:** Crypto assets don't fit cleanly into the equities data model this app is built around (Yahoo Finance quotes/earnings/analyst ratings, SPY-benchmarked risk metrics) — supporting them well would mean a new market-data source, new risk metrics (no beta-vs-SPY equivalent), and likely a new sentiment pipeline, none of which share much with the equities stack. Flagging it now as a distinct future feature keeps it from being conflated with the equities roadmap while preserving the idea for later.

## Decision 45: Cache Upsert Fix — Composite Unique Constraint Mismatch

**Date:** Phase 5 (2026-08-14)

**Context:** During Adanos integration testing, discovered that no data was being cached at all — the entire cache table was empty despite weeks of usage. Every `getOrFetch()` call was re-fetching from external APIs (Yahoo Finance, Groq, Adanos) on every page load.

**Root cause:** The `cache` table has a composite unique constraint `(user_id, cache_key)`, but the cache utility was using `onConflict: "cache_key"` (single column) and not passing `user_id` at all. Postgres rejects an `ON CONFLICT` clause that doesn't match an existing unique constraint, so every upsert silently failed. The silent `catch {}` in the cache utility hid the error completely.

**Impact:** All cache types were affected — `price`, `analyst`, `earnings`, `social-sentiment`, `news`, `rec-trend`. Every API route was hitting external services on every request, burning Adanos quota, Groq tokens, and Yahoo rate limits unnecessarily.

**Fix:**
1. Added `user_id` to the upsert payload (extracted via `getClaims()`)
2. Changed `onConflict` to `"user_id,cache_key"` to match the composite constraint
3. Added `user_id` filter to cache reads for correctness
4. Added error logging to the cache utility so upsert failures are no longer silent

**Reasoning:** Silent failure in a caching layer is one of the most dangerous patterns — the app appears to work correctly (data is fetched and returned) but performance and cost are dramatically worse than expected. Adding the error logging ensures any future cache issues are immediately visible in server logs. The fix is a one-line change to the conflict target, but the debugging insight (checking for unique constraints vs. the ON CONFLICT clause) is the kind of Postgres knowledge that matters in production.

---

## Decision 46: Macro News Dashboard — RSS Feed Aggregation vs. News APIs

**Date:** Phase 6 (2026-08-14)

**Context:** The macro dashboard needs real-time-ish news from 5 categories: Federal Reserve, Geopolitics, Commodities, Jobs/Economic Data, and US Government. Unlike per-ticker news (which uses Yahoo Finance's news endpoint), macro news spans entire sectors and policy domains.

**Options considered:**
1. **RSS feed aggregation** — free XML feeds from authoritative sources (Fed, Al Jazeera, BBC, OilPrice, MarketWatch, White House)
2. **News API (newsapi.org, GNews)** — search-based news APIs with free tiers
3. **Web scraping** — parse HTML from news sites directly
4. **Social media feeds** — aggregate from Twitter/X financial accounts

**Pros/cons:**

| Option | Pros | Cons |
|--------|------|------|
| RSS feeds | Free, no auth needed, authoritative sources, well-structured XML, `rss-parser` npm package handles parsing | Not all sources have RSS; feeds can break or go offline; limited to what each source publishes |
| News API | Search-based (flexible categories), structured JSON | Free tiers have severe limits (100 req/day for newsapi.org); rate limits burn fast with 5 categories |
| Web scraping | Can get any content | Fragile (HTML changes break scrapers), potential legal issues, heavy maintenance |
| Social media | Real-time, opinionated takes | Twitter API is $100/month minimum; noise-to-signal ratio is poor for macro analysis |

**Decision:** RSS feed aggregation with `Promise.allSettled` for graceful degradation

**Feed selection:**
- Federal Reserve: `federalreserve.gov/feeds/press_all.xml` (official Fed press releases)
- Geopolitics: Al Jazeera (`aljazeera.com/xml/rss/all.xml`) + BBC World (`feeds.bbci.co.uk/news/world/rss.xml`)
- Commodities: OilPrice.com (`oilprice.com/rss/main`) — already commodity-focused, no keyword filter needed
- Jobs/Economic Data: MarketWatch Top Stories (`feeds.content.dowjones.io/public/rss/mw_topstories`) — broad market coverage includes economic data
- US Government: White House Wire (`whitehouse.gov/wire/feed/`)

**Reasoning:** RSS is the only option that's both free and authoritative. Government institutions (the Fed, the White House) publish official RSS feeds — no API key, no rate limits, no cost. For geopolitics, Al Jazeera + BBC World provide broad international coverage from two editorially independent sources. OilPrice.com is commodity-focused by nature so no keyword filtering is needed. `Promise.allSettled` means if one feed is down, the other 4 categories still render — graceful degradation rather than all-or-nothing.

**Feed URL discovery process:** The original spec's URLs were largely broken (Reuters discontinued their RSS feeds, BLS returns 403, Treasury returns 404, White House main `/feed/` returns 404). Each URL was tested via `rss-parser` and replaced with a working alternative. This fragility is inherent to RSS — feeds move or die without warning. The working URLs were validated on 2026-08-14.

---

## Decision 47: Macro AI Summaries — Gemini Flash Lite with Cross-Category Synthesis

**Date:** Phase 6 (2026-08-14)

**Options considered:**
1. **Per-category summaries only** — AI summarizes each category independently
2. **Cross-category synthesis only** — one macro outlook paragraph
3. **Both: per-category + cross-category synthesis** — individual summaries plus a macro outlook connecting themes

**Decision:** Both — per-category analysis (4-6 sentences each) + cross-category macro outlook (5-7 sentences)

**Reasoning:** Per-category summaries help users understand "what's happening in commodities" at a glance, while the cross-category macro outlook identifies connections the user might miss — e.g., "rising oil prices + Fed hold signals + weak jobs data = stagflation risk." The macro outlook is the highest-value feature on the page because it's the kind of analysis that typically requires reading across multiple sources and synthesizing. Using Gemini Flash Lite (via the existing `generateCompletion` abstraction from Decision 30) keeps costs near-zero. The prompt instructs the AI to write with conviction, name specific sectors and asset classes, and avoid hedging language — calibrated for "sophisticated investors" per the feedback in `feedback_thesis_quality.md`.

---

## Decision 48: Macro Cache TTL — 1 Hour vs Longer

**Date:** Phase 6 (2026-08-14)

**Options considered:**
1. **1 hour** — fresh enough for news, conservative on API calls
2. **4 hours** — match the price cache TTL
3. **15 minutes** — near-real-time macro updates

**Decision:** 1 hour (`MACRO_TTL = 3600`)

**Reasoning:** Macro news moves faster than portfolio prices — a Fed announcement or geopolitical event can shift markets within minutes. But the dashboard is for analysis, not breaking news alerts. 1 hour balances freshness against cost: each cache miss triggers 6 RSS feed fetches + 1 Gemini API call. At 1 hour, a user checking the dashboard a few times a day gets mostly cached responses (fast, free) with periodic refreshes. The 48-hour article window (filtered in `filterRecentArticles`) ensures the AI always has recent context even if some feeds publish infrequently.

---

## Decision 49: Shared Macro Cache — NULL user_id with Partial Unique Index

**Date:** Phase 6 (2026-08-14)

**Problem:** The macro news dashboard returns the same content for all users (same RSS feeds, same AI summaries). Caching per-user wastes storage and API calls — every user's first visit triggers a fresh RSS+Gemini fetch even though the result is identical.

**Options considered:**
1. **Sentinel UUID** — use a fixed UUID like `00000000-0000-0000-0000-000000000000` as a "shared" user_id
2. **NULL user_id with partial unique index** — shared entries have `user_id IS NULL`, per-user entries use their real user_id
3. **Separate shared_cache table** — a dedicated table without user_id at all

**Decision:** NULL user_id with a partial unique index (`CREATE UNIQUE INDEX cache_shared_key ON cache (cache_key) WHERE user_id IS NULL`)

**Reasoning:** The sentinel UUID approach failed — the `cache` table has a FK constraint on `user_id` referencing `auth.users`, so inserting a non-existent UUID violates the constraint. Discovered this through server error logs after initial deployment. The NULL approach works because PostgreSQL FK constraints with `MATCH SIMPLE` (the default) skip validation for NULL values. The partial unique index ensures one shared entry per cache_key. The `getOrFetch<T>()` utility now accepts `shared: true` — shared reads use `.is("user_id", null)`, shared writes use delete-then-insert (since PostgREST's `onConflict` doesn't support partial index names). A separate table was rejected because it would duplicate the cache schema and require maintaining two cache utilities.

---

## Decision 50: Section Preferences — Per-User Customization with Optimistic UI

**Date:** Phase 6 (2026-08-14)

**Options considered:**
1. **LocalStorage only** — fast, no API call, but doesn't persist across devices
2. **Database-backed with `macro_preferences` table** — persists across devices and sessions
3. **URL query params** — shareable but ugly and ephemeral

**Decision:** Database-backed `macro_preferences` table with RLS + optimistic UI updates

**Implementation:**
- `macro_preferences` table: `user_id` (unique), `enabled_sections` (text array), `updated_at`
- RLS policies enforce `auth.uid() = user_id` for all operations
- Default: all 5 sections enabled (handled in API when no row exists, not via DB default)
- API route (`/api/macro/preferences`): GET returns enabled sections, PUT validates and upserts
- UI: gear icon in Macro Outlook header opens a settings panel with checkboxes
- Optimistic update: UI toggles immediately, rolls back on API failure
- Guard: cannot uncheck the last remaining section (minimum 1 required)

**Reasoning:** Database persistence was worth the extra table because AlphaStrat is designed to work across devices — a user who customizes on desktop expects the same view on mobile. Optimistic UI avoids the jarring delay of waiting for a round-trip before showing the toggle. The 1-5 section constraint prevents both empty dashboards and unbounded growth if more sections are added later.

---

## Decision 51: Earnings + Options Phase — Bundled as Phase 8

**Date:** Phase 6 (2026-08-14)

**Concept:** A new phase combining an Earnings Page with an Options feature. During earnings season, the page tracks earnings surprises and misses for tickers in the user's Watchlist. Options pricing data (IV, expected moves) tells a complementary story about investor expectations — high IV before earnings implies the market expects a big move, and IV crush after the report reveals whether the move met expectations.

**Why bundle them:** Earnings and options are deeply intertwined during earnings season. Expected moves derived from options pricing directly inform whether an earnings surprise was "priced in." Showing them separately would force users to mentally cross-reference two pages. Together, they answer: "Did the stock beat expectations, and did the market already know?"

**Key features (preliminary):**
- Earnings calendar with beat/miss tracking for Watchlist tickers
- Historical earnings surprise trends per ticker
- Options-derived expected move vs actual move comparison
- IV crush visualization (pre-earnings IV vs post-earnings IV)
- Integration with Watchlist — only tracks tickers the user cares about

**Data sources (TBD):** Yahoo Finance earnings data is already partially available (used in the earnings calendar). Options chain data will need a new source — Yahoo Finance has options endpoints but reliability and rate limits need investigation.

**Status:** Conceptual. No implementation work started. Detailed spec will be written during Phase 8 planning.

---

## Decision 52: AI Thesis Generation — Fundamentals-Driven with Shared Cache

**Date:** Phase 7 (2026-08-14)

**Options considered:**
1. **Pre-generate theses for all watchlist tickers** — background job on page load
2. **On-demand generation with per-user cache** — generate when clicked, cached per user
3. **On-demand generation with shared cache** — generate when clicked, shared across all users

**Decision:** On-demand generation with shared 7-day cache via `getOrFetch<T>({ shared: true })`

**Reasoning:** Fundamental data and AI-generated theses are ticker-specific, not user-specific — every user viewing AAPL gets the same P/E, margins, and FCF data, so the thesis is identical. Shared caching means the first user to view a ticker pays the generation cost (one Yahoo Finance fetch + one Gemini call), and all subsequent users get an instant cache hit. 7-day TTL matches the pace of fundamental data changes — quarterly earnings are the primary catalyst, and a refresh button provides an escape hatch. On-demand generation avoids wasting Gemini API calls on tickers nobody expands, which matters for the free tier's rate limits. The fundamentals fetcher consolidates 7 Yahoo Finance `quoteSummary` modules into a single request, minimizing network overhead.

---

## Decision 53: Earnings Tab — Fundamentals Cache Reuse vs Dedicated Fetch

**Date:** Phase 8a

**Options considered:**
1. **Reuse thesis cache directly** — read the ThesisResponse from the thesis cache and extract earnings fields
2. **Separate fundamentals cache (chosen)** — cache TickerFundamentals under its own key `fundamentals-${ticker}`, shared 7-day TTL
3. **Dedicated earnings-only Yahoo fetch** — separate quoteSummary call with only earnings modules

**Decision:** Option 2 — Separate fundamentals cache

**Reasoning:** The thesis route caches the final AI-generated `ThesisResponse`, not the raw fundamentals. A separate fundamentals cache under `fundamentals-${ticker}` lets the earnings tab reuse the same raw data without depending on thesis generation. The 7-day shared TTL matches thesis since both read the same Yahoo data. Extended `getTickerFundamentals` from 7 to 9 modules (adding `earningsTrend` + `calendarEvents`) — one Yahoo request serves both thesis generation and earnings display. No AI generation needed for this tab: pure data visualization with Recharts.

---

### Decision 54: Options Tab — Pre-Computed Quant Signals + AI Narrative

**Date:** 2026-08-15
**Context:** Phase 8b options chain analysis — how to interpret options data for equity analysis
**Options considered:**
1. Raw chain → capable AI model (high token cost, model may hallucinate math)
2. Pre-computed signals → cheap AI model (deterministic math, small prompt, Gemini Lite sufficient)
3. Hybrid — key signals computed, rest AI-inferred (awkward middle ground)

**Choice:** Option 2 — Pure TypeScript Black-Scholes quant engine computes all signals (pricing, Greeks, IV surface, expected move, put/call ratio, skew, unusual activity, max pain), then Gemini Flash Lite synthesizes the narrative.

**Why:** Intelligence lives in the math and the prompt, not the model. Black-Scholes is well-defined math with known test vectors — fully unit-testable. Pre-computing means smaller prompts (~800 tokens input), lower token cost, and deterministic financial calculations. The AI's job is interpretation — connecting signals to market narrative — which Gemini Lite handles well when given clean structured inputs. Risk-free rate fetched live from Yahoo ^IRX (13-week T-bill), cached 24hr.

**Trade-off:** More TypeScript code to write (Black-Scholes, Greeks, signal derivation), but this code is the most testable and reliable part of the system.

*This log will be updated as new decisions are made in Phases 6-8.*
