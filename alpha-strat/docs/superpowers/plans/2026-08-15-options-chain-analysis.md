# Options Chain Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Options tab to the watchlist detail panel that uses Black-Scholes pricing and pre-computed options signals to generate an institutional-grade AI narrative about what the options market is pricing in for a stock.

**Architecture:** Yahoo Finance v7 options endpoint provides raw chain data. A pure TypeScript quant engine (`lib/finance/`) computes Black-Scholes prices, Greeks, IV surface, expected move, put/call ratios, skew, unusual activity, and max pain. These pre-computed signals feed a Gemini Flash Lite prompt that synthesizes a structured narrative. The Options tab visualizes signals with Recharts charts and displays the AI analysis.

**Tech Stack:** Yahoo Finance v7 (options chain), Yahoo Finance v8 (`^IRX` for risk-free rate), TypeScript Black-Scholes, Gemini Flash Lite, Recharts, shared cache (4hr TTL)

## Global Constraints

- Zero recurring cost — no new API keys or paid services
- No Python — all Node.js
- Single Next.js deployment
- Follow existing patterns: lazy-loaded tabs, `*Fetched` boolean state, ticker-change reset, skeleton loading
- Recharts for all charts (already a dependency)
- Yahoo Finance crumb/cookie auth (reuse existing `getYahooCrumb()` from `lib/market/yahoo.ts`)
- Options analysis framing: equity analyst using options as a sentiment indicator, NOT options trading advice
- ESLint with `react-hooks/purity` — no inline `Date.now()` or side effects in JSX
- Use `generateCompletion(system, user, "gemini")` for AI calls (existing client in `lib/ai/client.ts`)
- Shared cache via `getOrFetch<T>(supabase, key, type, ttl, fetcher, { shared: true })` from `lib/cache/index.ts`
- Auth via `getClaims()` for API routes (JWT verification, no DB round-trip)
- All pure finance functions must be unit tested

---

### Task 1: Types + Black-Scholes Engine + Tests

**Files:**
- Create: `lib/market/types-options.ts`
- Create: `lib/finance/black-scholes.ts`
- Create: `lib/finance/black-scholes.test.ts`
- Modify: `lib/cache/freshness.ts`

**Interfaces:**
- Consumes: nothing (foundational task)
- Produces:
  - Types: `OptionsContract`, `OptionsChain`, `OptionsSnapshot`, `OptionsSignals`, `ExpectedMove`, `IvSkew`, `IvSurfacePoint`, `UnusualActivityEntry`, `OptionsAnalysisResponse`
  - Functions: `blackScholesPrice(S, K, T, r, sigma, type): number`, `impliedVolatility(marketPrice, S, K, T, r, type): number | null`, `delta(S, K, T, r, sigma, type): number`, `gamma(S, K, T, r, sigma): number`, `theta(S, K, T, r, sigma, type): number`, `vega(S, K, T, r, sigma): number`, `cdf(x): number`
  - Constants: `OPTIONS_TTL`, `RFR_TTL`

- [ ] **Step 1: Create options types file**

Create `lib/market/types-options.ts`:

```typescript
export interface OptionsContract {
  strike: number;
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  inTheMoney: boolean;
  contractType: "call" | "put";
  expiry: string; // ISO date
}

export interface OptionsChain {
  expiryDate: string; // ISO date
  daysToExpiry: number;
  calls: OptionsContract[];
  puts: OptionsContract[];
}

export interface OptionsSnapshot {
  ticker: string;
  underlyingPrice: number;
  chains: OptionsChain[];
  fetchedAt: string; // ISO timestamp
}

export interface ExpectedMove {
  dollars: number;
  percent: number;
  upperBound: number;
  lowerBound: number;
}

export interface IvSkew {
  direction: "put-heavy" | "call-heavy" | "neutral";
  magnitude: number;
}

export interface IvSurfacePoint {
  moneyness: number; // % from ATM (-20 to +20)
  iv: number;
  expiry: string;
}

export interface UnusualActivityEntry {
  strike: number;
  expiry: string;
  type: "call" | "put";
  volume: number;
  openInterest: number;
  volumeOiRatio: number;
}

export interface OptionsSignals {
  expectedMove: ExpectedMove;
  putCallRatio: number;
  ivSkew: IvSkew;
  maxPain: number;
  atmIv: number;
  historicalVolatility: number;
  unusualActivity: UnusualActivityEntry[];
  termStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  greeksSummary: {
    atmDelta: number;
    atmGamma: number;
    atmTheta: number;
    atmVega: number;
  };
}

export interface OptionsAnalysisResponse {
  ticker: string;
  underlyingPrice: number;
  signals: OptionsSignals;
  analysis: {
    marketPositioning: string;
    expectedMoveAnalysis: string;
    volatilityAssessment: string;
    notableFlow: string;
    keyRisksAndCatalysts: string;
    actionableTakeaway: string;
  };
  ivSurface: IvSurfacePoint[];
  ivTermStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  positioning: Array<{
    strike: number;
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
  }>;
  expectedMove: ExpectedMove;
  maxPain: number;
  putCallRatio: number;
}
```

- [ ] **Step 2: Add cache TTL constants**

Add to `lib/cache/freshness.ts`:

```typescript
export const OPTIONS_TTL = 4 * 3600; // 4 hours — options data is time-sensitive but not real-time
export const RFR_TTL = 24 * 3600; // 24 hours — risk-free rate barely moves day-to-day
```

- [ ] **Step 3: Write Black-Scholes tests**

Create `lib/finance/black-scholes.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  cdf,
  blackScholesPrice,
  impliedVolatility,
  delta,
  gamma,
  theta,
  vega,
} from "./black-scholes";

describe("cdf (cumulative normal distribution)", () => {
  it("returns 0.5 at zero", () => {
    expect(cdf(0)).toBeCloseTo(0.5, 6);
  });

  it("returns ~0.8413 at 1.0", () => {
    expect(cdf(1.0)).toBeCloseTo(0.8413, 4);
  });

  it("returns ~0.1587 at -1.0", () => {
    expect(cdf(-1.0)).toBeCloseTo(0.1587, 4);
  });

  it("returns ~0.9772 at 2.0", () => {
    expect(cdf(2.0)).toBeCloseTo(0.9772, 4);
  });
});

describe("blackScholesPrice", () => {
  // Standard test case: S=100, K=100, T=1, r=0.05, sigma=0.2
  const S = 100, K = 100, T = 1, r = 0.05, sigma = 0.2;

  it("prices ATM call correctly", () => {
    const price = blackScholesPrice(S, K, T, r, sigma, "call");
    // Known BS value for these inputs: ~10.4506
    expect(price).toBeCloseTo(10.4506, 2);
  });

  it("prices ATM put correctly", () => {
    const price = blackScholesPrice(S, K, T, r, sigma, "put");
    // Known BS value: ~5.5735
    expect(price).toBeCloseTo(5.5735, 2);
  });

  it("satisfies put-call parity: C - P = S - K*e^(-rT)", () => {
    const callPrice = blackScholesPrice(S, K, T, r, sigma, "call");
    const putPrice = blackScholesPrice(S, K, T, r, sigma, "put");
    const parity = S - K * Math.exp(-r * T);
    expect(callPrice - putPrice).toBeCloseTo(parity, 4);
  });

  it("deep ITM call approaches intrinsic value", () => {
    const deepItm = blackScholesPrice(150, 100, 0.01, r, sigma, "call");
    expect(deepItm).toBeCloseTo(50, 0); // intrinsic = 50
  });

  it("deep OTM call approaches zero", () => {
    const deepOtm = blackScholesPrice(50, 100, 0.01, r, sigma, "call");
    expect(deepOtm).toBeCloseTo(0, 2);
  });

  it("returns 0 when time to expiry is 0", () => {
    // ITM call at expiry = intrinsic
    expect(blackScholesPrice(110, 100, 0, r, sigma, "call")).toBeCloseTo(10, 4);
    // OTM call at expiry = 0
    expect(blackScholesPrice(90, 100, 0, r, sigma, "call")).toBeCloseTo(0, 4);
  });
});

describe("impliedVolatility", () => {
  it("round-trips: price → IV → should match original sigma", () => {
    const S = 100, K = 100, T = 1, r = 0.05, sigma = 0.2;
    const price = blackScholesPrice(S, K, T, r, sigma, "call");
    const solvedIv = impliedVolatility(price, S, K, T, r, "call");
    expect(solvedIv).not.toBeNull();
    expect(solvedIv!).toBeCloseTo(sigma, 4);
  });

  it("returns null for zero market price", () => {
    const result = impliedVolatility(0, 100, 100, 1, 0.05, "call");
    expect(result).toBeNull();
  });

  it("solves for OTM put IV", () => {
    const S = 100, K = 90, T = 0.5, r = 0.05, sigma = 0.3;
    const price = blackScholesPrice(S, K, T, r, sigma, "put");
    const solvedIv = impliedVolatility(price, S, K, T, r, "put");
    expect(solvedIv).not.toBeNull();
    expect(solvedIv!).toBeCloseTo(sigma, 3);
  });
});

describe("Greeks", () => {
  const S = 100, K = 100, T = 1, r = 0.05, sigma = 0.2;

  it("ATM call delta is approximately 0.5-0.6", () => {
    const d = delta(S, K, T, r, sigma, "call");
    expect(d).toBeGreaterThan(0.5);
    expect(d).toBeLessThan(0.7);
  });

  it("ATM put delta is negative", () => {
    const d = delta(S, K, T, r, sigma, "put");
    expect(d).toBeLessThan(0);
    expect(d).toBeGreaterThan(-0.6);
  });

  it("deep ITM call delta approaches 1", () => {
    const d = delta(200, 100, 1, r, sigma, "call");
    expect(d).toBeGreaterThan(0.95);
  });

  it("deep OTM call delta approaches 0", () => {
    const d = delta(50, 100, 1, r, sigma, "call");
    expect(d).toBeLessThan(0.05);
  });

  it("gamma is positive", () => {
    const g = gamma(S, K, T, r, sigma);
    expect(g).toBeGreaterThan(0);
  });

  it("ATM gamma is highest", () => {
    const atmGamma = gamma(100, 100, T, r, sigma);
    const otmGamma = gamma(80, 100, T, r, sigma);
    expect(atmGamma).toBeGreaterThan(otmGamma);
  });

  it("theta is negative for long options", () => {
    const t = theta(S, K, T, r, sigma, "call");
    expect(t).toBeLessThan(0);
  });

  it("vega is positive", () => {
    const v = vega(S, K, T, r, sigma);
    expect(v).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run lib/finance/black-scholes.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 5: Implement Black-Scholes engine**

Create `lib/finance/black-scholes.ts`:

```typescript
/**
 * Cumulative standard normal distribution (Abramowitz & Stegun approximation).
 */
export function cdf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);

  return 0.5 * (1.0 + sign * y);
}

function pdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function d1(S: number, K: number, T: number, r: number, sigma: number): number {
  return (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * Math.sqrt(T));
}

function d2(S: number, K: number, T: number, r: number, sigma: number): number {
  return d1(S, K, T, r, sigma) - sigma * Math.sqrt(T);
}

export function blackScholesPrice(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): number {
  if (T <= 0) {
    return type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  }

  const D1 = d1(S, K, T, r, sigma);
  const D2 = d2(S, K, T, r, sigma);

  if (type === "call") {
    return S * cdf(D1) - K * Math.exp(-r * T) * cdf(D2);
  } else {
    return K * Math.exp(-r * T) * cdf(-D2) - S * cdf(-D1);
  }
}

export function impliedVolatility(
  marketPrice: number,
  S: number,
  K: number,
  T: number,
  r: number,
  type: "call" | "put"
): number | null {
  if (marketPrice <= 0 || T <= 0) return null;

  let sigma = 0.3; // initial guess
  const maxIter = 100;
  const tolerance = 1e-6;

  for (let i = 0; i < maxIter; i++) {
    const price = blackScholesPrice(S, K, T, r, sigma, type);
    const v = vega(S, K, T, r, sigma);

    if (v < 1e-12) return null; // vega too small, can't converge

    const diff = price - marketPrice;
    if (Math.abs(diff) < tolerance) return sigma;

    sigma = sigma - diff / (v * 100); // vega is per 1% move, scale to match
    if (sigma <= 0) sigma = 0.001;
    if (sigma > 10) return null; // unreasonable IV
  }

  return null; // did not converge
}

export function delta(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): number {
  if (T <= 0) {
    if (type === "call") return S > K ? 1 : 0;
    return S < K ? -1 : 0;
  }
  const D1 = d1(S, K, T, r, sigma);
  return type === "call" ? cdf(D1) : cdf(D1) - 1;
}

export function gamma(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return 0;
  const D1 = d1(S, K, T, r, sigma);
  return pdf(D1) / (S * sigma * Math.sqrt(T));
}

export function theta(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
  type: "call" | "put"
): number {
  if (T <= 0) return 0;
  const D1 = d1(S, K, T, r, sigma);
  const D2 = d2(S, K, T, r, sigma);
  const sqrtT = Math.sqrt(T);

  const common = -(S * pdf(D1) * sigma) / (2 * sqrtT);

  if (type === "call") {
    return (common - r * K * Math.exp(-r * T) * cdf(D2)) / 365;
  } else {
    return (common + r * K * Math.exp(-r * T) * cdf(-D2)) / 365;
  }
}

export function vega(
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number
): number {
  if (T <= 0) return 0;
  const D1 = d1(S, K, T, r, sigma);
  return (S * pdf(D1) * Math.sqrt(T)) / 100; // per 1% change in IV
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run lib/finance/black-scholes.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/market/types-options.ts lib/finance/black-scholes.ts lib/finance/black-scholes.test.ts lib/cache/freshness.ts
git commit -m "feat(options): add types, Black-Scholes engine with Greeks, and tests"
```

---

### Task 2: Options Signal Analysis Engine + Tests

**Files:**
- Create: `lib/finance/options-analysis.ts`
- Create: `lib/finance/options-analysis.test.ts`

**Interfaces:**
- Consumes:
  - `OptionsSnapshot`, `OptionsChain`, `OptionsContract`, `OptionsSignals`, `ExpectedMove`, `IvSkew`, `IvSurfacePoint`, `UnusualActivityEntry` from `lib/market/types-options.ts`
  - `delta`, `gamma`, `theta`, `vega` from `lib/finance/black-scholes.ts`
- Produces:
  - `expectedMove(chains: OptionsChain[], spotPrice: number): ExpectedMove`
  - `putCallRatio(chain: OptionsChain): number`
  - `ivSkew(chain: OptionsChain, spotPrice: number): IvSkew`
  - `ivSurface(chains: OptionsChain[], spotPrice: number): IvSurfacePoint[]`
  - `unusualActivity(chain: OptionsChain): UnusualActivityEntry[]`
  - `maxPainStrike(chain: OptionsChain): number`
  - `historicalVolatility(closes: number[]): number`
  - `computeOptionsSignals(snapshot: OptionsSnapshot, riskFreeRate: number, priceHistory: number[]): OptionsSignals`

- [ ] **Step 1: Write options analysis tests**

Create `lib/finance/options-analysis.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  expectedMove,
  putCallRatio,
  ivSkew,
  unusualActivity,
  maxPainStrike,
  historicalVolatility,
  computeOptionsSignals,
} from "./options-analysis";
import type { OptionsChain, OptionsContract, OptionsSnapshot } from "@/lib/market/types-options";

function makeContract(overrides: Partial<OptionsContract>): OptionsContract {
  return {
    strike: 100,
    bid: 5,
    ask: 6,
    lastPrice: 5.5,
    volume: 100,
    openInterest: 500,
    impliedVolatility: 0.3,
    inTheMoney: false,
    contractType: "call",
    expiry: "2026-09-19",
    ...overrides,
  };
}

function makeChain(calls: Partial<OptionsContract>[], puts: Partial<OptionsContract>[]): OptionsChain {
  return {
    expiryDate: "2026-09-19",
    daysToExpiry: 35,
    calls: calls.map((c) => makeContract({ contractType: "call", ...c })),
    puts: puts.map((p) => makeContract({ contractType: "put", ...p })),
  };
}

describe("expectedMove", () => {
  it("calculates from ATM straddle price", () => {
    const chain = makeChain(
      [
        { strike: 95, bid: 8, ask: 9 },
        { strike: 100, bid: 4, ask: 5 },   // ATM call, mid = 4.5
        { strike: 105, bid: 1, ask: 2 },
      ],
      [
        { strike: 95, bid: 1, ask: 2 },
        { strike: 100, bid: 3.5, ask: 4.5 }, // ATM put, mid = 4.0
        { strike: 105, bid: 7, ask: 8 },
      ]
    );
    const result = expectedMove([chain], 100);
    // ATM straddle = 4.5 + 4.0 = 8.5
    expect(result.dollars).toBeCloseTo(8.5, 1);
    expect(result.percent).toBeCloseTo(8.5, 1);
    expect(result.upperBound).toBeCloseTo(108.5, 1);
    expect(result.lowerBound).toBeCloseTo(91.5, 1);
  });
});

describe("putCallRatio", () => {
  it("calculates total put volume / total call volume", () => {
    const chain = makeChain(
      [{ strike: 100, volume: 1000 }, { strike: 105, volume: 500 }],
      [{ strike: 95, volume: 800 }, { strike: 100, volume: 700 }]
    );
    // put vol = 1500, call vol = 1500 → ratio = 1.0
    expect(putCallRatio(chain)).toBeCloseTo(1.0, 2);
  });

  it("returns 0 when no call volume", () => {
    const chain = makeChain(
      [{ strike: 100, volume: 0 }],
      [{ strike: 100, volume: 500 }]
    );
    expect(putCallRatio(chain)).toBe(Infinity);
  });
});

describe("ivSkew", () => {
  it("detects put-heavy skew", () => {
    const chain = makeChain(
      [
        { strike: 105, impliedVolatility: 0.25 },
        { strike: 110, impliedVolatility: 0.22 },
        { strike: 115, impliedVolatility: 0.20 },
      ],
      [
        { strike: 85, impliedVolatility: 0.40 },
        { strike: 90, impliedVolatility: 0.38 },
        { strike: 95, impliedVolatility: 0.35 },
      ]
    );
    const result = ivSkew(chain, 100);
    expect(result.direction).toBe("put-heavy");
    expect(result.magnitude).toBeGreaterThan(0.1);
  });

  it("detects neutral skew", () => {
    const chain = makeChain(
      [
        { strike: 105, impliedVolatility: 0.30 },
        { strike: 110, impliedVolatility: 0.30 },
      ],
      [
        { strike: 90, impliedVolatility: 0.31 },
        { strike: 95, impliedVolatility: 0.30 },
      ]
    );
    const result = ivSkew(chain, 100);
    expect(result.direction).toBe("neutral");
  });
});

describe("unusualActivity", () => {
  it("flags contracts with volume > 2x open interest", () => {
    const chain = makeChain(
      [
        { strike: 100, volume: 100, openInterest: 500 },  // normal
        { strike: 110, volume: 2000, openInterest: 300 },  // unusual (6.67x)
      ],
      [
        { strike: 90, volume: 1500, openInterest: 200 },   // unusual (7.5x)
        { strike: 95, volume: 50, openInterest: 1000 },    // normal
      ]
    );
    const result = unusualActivity(chain);
    expect(result.length).toBe(2);
    expect(result[0].volumeOiRatio).toBeGreaterThan(result[1].volumeOiRatio);
    expect(result[0].strike).toBe(90); // highest ratio first
  });

  it("returns empty array when no unusual activity", () => {
    const chain = makeChain(
      [{ strike: 100, volume: 100, openInterest: 500 }],
      [{ strike: 95, volume: 50, openInterest: 1000 }]
    );
    expect(unusualActivity(chain)).toHaveLength(0);
  });
});

describe("maxPainStrike", () => {
  it("finds the strike minimizing total option payout", () => {
    const chain = makeChain(
      [
        { strike: 90, openInterest: 100 },
        { strike: 100, openInterest: 500 },
        { strike: 110, openInterest: 200 },
      ],
      [
        { strike: 90, openInterest: 200 },
        { strike: 100, openInterest: 400 },
        { strike: 110, openInterest: 100 },
      ]
    );
    const mp = maxPainStrike(chain);
    // Should be one of the strikes (90, 100, or 110)
    expect([90, 100, 110]).toContain(mp);
  });
});

describe("historicalVolatility", () => {
  it("computes annualized std dev of log returns", () => {
    // Constant price → 0 volatility
    const flat = Array(31).fill(100);
    expect(historicalVolatility(flat)).toBeCloseTo(0, 4);
  });

  it("increases with more volatile prices", () => {
    const calm = [100, 101, 100, 101, 100, 101, 100, 101, 100, 101];
    const wild = [100, 110, 90, 115, 85, 120, 80, 125, 75, 130];
    expect(historicalVolatility(wild)).toBeGreaterThan(historicalVolatility(calm));
  });
});

describe("computeOptionsSignals", () => {
  it("assembles all signals from a snapshot", () => {
    const snapshot: OptionsSnapshot = {
      ticker: "AAPL",
      underlyingPrice: 100,
      chains: [
        makeChain(
          [
            { strike: 95, bid: 7, ask: 8, volume: 200, openInterest: 500, impliedVolatility: 0.28 },
            { strike: 100, bid: 4, ask: 5, volume: 300, openInterest: 600, impliedVolatility: 0.25 },
            { strike: 105, bid: 1.5, ask: 2.5, volume: 100, openInterest: 400, impliedVolatility: 0.23 },
          ],
          [
            { strike: 95, bid: 1, ask: 2, volume: 150, openInterest: 300, impliedVolatility: 0.30 },
            { strike: 100, bid: 3, ask: 4, volume: 250, openInterest: 500, impliedVolatility: 0.26 },
            { strike: 105, bid: 6, ask: 7, volume: 100, openInterest: 200, impliedVolatility: 0.22 },
          ]
        ),
      ],
      fetchedAt: "2026-08-15T12:00:00Z",
    };

    const priceHistory = Array.from({ length: 31 }, (_, i) => 100 + Math.sin(i) * 2);
    const signals = computeOptionsSignals(snapshot, 0.0525, priceHistory);

    expect(signals.expectedMove.dollars).toBeGreaterThan(0);
    expect(signals.putCallRatio).toBeGreaterThan(0);
    expect(signals.maxPain).toBeGreaterThan(0);
    expect(signals.atmIv).toBeGreaterThan(0);
    expect(signals.historicalVolatility).toBeGreaterThanOrEqual(0);
    expect(signals.termStructure).toHaveLength(1);
    expect(signals.greeksSummary.atmDelta).toBeGreaterThan(0);
    expect(signals.greeksSummary.atmGamma).toBeGreaterThan(0);
    expect(signals.greeksSummary.atmVega).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/finance/options-analysis.test.ts`
Expected: FAIL (module not found)

- [ ] **Step 3: Implement options signal analysis**

Create `lib/finance/options-analysis.ts`:

```typescript
import type {
  OptionsChain,
  OptionsSnapshot,
  OptionsSignals,
  ExpectedMove,
  IvSkew,
  IvSurfacePoint,
  UnusualActivityEntry,
} from "@/lib/market/types-options";
import { delta, gamma, theta, vega } from "./black-scholes";

function findAtmStrike(contracts: Array<{ strike: number }>, spotPrice: number): number {
  let closest = contracts[0].strike;
  let minDiff = Math.abs(contracts[0].strike - spotPrice);
  for (const c of contracts) {
    const diff = Math.abs(c.strike - spotPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closest = c.strike;
    }
  }
  return closest;
}

function midPrice(bid: number | null, ask: number | null): number {
  if (bid != null && ask != null) return (bid + ask) / 2;
  if (bid != null) return bid;
  if (ask != null) return ask;
  return 0;
}

export function expectedMove(chains: OptionsChain[], spotPrice: number): ExpectedMove {
  const nearest = chains[0];
  if (!nearest) return { dollars: 0, percent: 0, upperBound: spotPrice, lowerBound: spotPrice };

  const atmStrike = findAtmStrike([...nearest.calls, ...nearest.puts], spotPrice);
  const atmCall = nearest.calls.find((c) => c.strike === atmStrike);
  const atmPut = nearest.puts.find((p) => p.strike === atmStrike);

  const callMid = atmCall ? midPrice(atmCall.bid, atmCall.ask) : 0;
  const putMid = atmPut ? midPrice(atmPut.bid, atmPut.ask) : 0;

  const straddle = callMid + putMid;
  return {
    dollars: straddle,
    percent: spotPrice > 0 ? (straddle / spotPrice) * 100 : 0,
    upperBound: spotPrice + straddle,
    lowerBound: spotPrice - straddle,
  };
}

export function putCallRatio(chain: OptionsChain): number {
  const callVol = chain.calls.reduce((sum, c) => sum + c.volume, 0);
  const putVol = chain.puts.reduce((sum, p) => sum + p.volume, 0);
  if (callVol === 0) return putVol > 0 ? Infinity : 0;
  return putVol / callVol;
}

export function ivSkew(chain: OptionsChain, spotPrice: number): IvSkew {
  const otmPuts = chain.puts.filter(
    (p) =>
      p.impliedVolatility != null &&
      p.strike < spotPrice * 0.95 &&
      p.strike >= spotPrice * 0.85
  );
  const otmCalls = chain.calls.filter(
    (c) =>
      c.impliedVolatility != null &&
      c.strike > spotPrice * 1.05 &&
      c.strike <= spotPrice * 1.15
  );

  if (otmPuts.length === 0 || otmCalls.length === 0) {
    return { direction: "neutral", magnitude: 0 };
  }

  const avgPutIv =
    otmPuts.reduce((s, p) => s + p.impliedVolatility!, 0) / otmPuts.length;
  const avgCallIv =
    otmCalls.reduce((s, c) => s + c.impliedVolatility!, 0) / otmCalls.length;

  const diff = avgPutIv - avgCallIv;
  const threshold = 0.02; // 2% IV difference threshold

  if (Math.abs(diff) < threshold) {
    return { direction: "neutral", magnitude: Math.abs(diff) };
  }
  return {
    direction: diff > 0 ? "put-heavy" : "call-heavy",
    magnitude: Math.abs(diff),
  };
}

export function ivSurface(chains: OptionsChain[], spotPrice: number): IvSurfacePoint[] {
  const points: IvSurfacePoint[] = [];

  for (const chain of chains) {
    const allContracts = [...chain.calls, ...chain.puts];
    for (const contract of allContracts) {
      if (contract.impliedVolatility == null) continue;
      const moneyness = ((contract.strike - spotPrice) / spotPrice) * 100;
      if (moneyness < -20 || moneyness > 20) continue;

      points.push({
        moneyness: Math.round(moneyness * 10) / 10,
        iv: contract.impliedVolatility,
        expiry: chain.expiryDate,
      });
    }
  }

  return points;
}

export function unusualActivity(chain: OptionsChain): UnusualActivityEntry[] {
  const entries: UnusualActivityEntry[] = [];
  const allContracts = [...chain.calls, ...chain.puts];

  for (const c of allContracts) {
    if (c.openInterest > 0 && c.volume / c.openInterest > 2) {
      entries.push({
        strike: c.strike,
        expiry: chain.expiryDate,
        type: c.contractType,
        volume: c.volume,
        openInterest: c.openInterest,
        volumeOiRatio: c.volume / c.openInterest,
      });
    }
  }

  return entries.sort((a, b) => b.volumeOiRatio - a.volumeOiRatio).slice(0, 5);
}

export function maxPainStrike(chain: OptionsChain): number {
  const allStrikes = [
    ...new Set([
      ...chain.calls.map((c) => c.strike),
      ...chain.puts.map((p) => p.strike),
    ]),
  ].sort((a, b) => a - b);

  let minPain = Infinity;
  let bestStrike = allStrikes[0];

  for (const testStrike of allStrikes) {
    let totalPain = 0;

    for (const call of chain.calls) {
      if (testStrike > call.strike) {
        totalPain += (testStrike - call.strike) * call.openInterest;
      }
    }
    for (const put of chain.puts) {
      if (testStrike < put.strike) {
        totalPain += (put.strike - testStrike) * put.openInterest;
      }
    }

    if (totalPain < minPain) {
      minPain = totalPain;
      bestStrike = testStrike;
    }
  }

  return bestStrike;
}

export function historicalVolatility(closes: number[]): number {
  if (closes.length < 2) return 0;

  const logReturns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > 0 && closes[i - 1] > 0) {
      logReturns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }

  if (logReturns.length < 2) return 0;

  const mean = logReturns.reduce((s, r) => s + r, 0) / logReturns.length;
  const variance =
    logReturns.reduce((s, r) => s + (r - mean) ** 2, 0) / (logReturns.length - 1);

  return Math.sqrt(variance * 252); // annualize
}

export function computeOptionsSignals(
  snapshot: OptionsSnapshot,
  riskFreeRate: number,
  priceHistory: number[]
): OptionsSignals {
  const nearest = snapshot.chains[0];
  const spot = snapshot.underlyingPrice;

  const em = expectedMove(snapshot.chains, spot);
  const pcr = nearest ? putCallRatio(nearest) : 0;
  const skew = nearest ? ivSkew(nearest, spot) : { direction: "neutral" as const, magnitude: 0 };
  const mp = nearest ? maxPainStrike(nearest) : spot;
  const hv = historicalVolatility(priceHistory);

  const ua = nearest ? unusualActivity(nearest) : [];

  // ATM IV from nearest expiry
  const atmStrike = nearest
    ? findAtmStrike([...nearest.calls, ...nearest.puts], spot)
    : spot;
  const atmCall = nearest?.calls.find((c) => c.strike === atmStrike);
  const atmIv = atmCall?.impliedVolatility ?? 0;

  // Term structure: ATM IV across all expiries
  const termStructure = snapshot.chains.map((chain) => {
    const chainAtm = findAtmStrike([...chain.calls, ...chain.puts], spot);
    const chainAtmCall = chain.calls.find((c) => c.strike === chainAtm);
    return {
      expiry: chain.expiryDate,
      daysToExpiry: chain.daysToExpiry,
      atmIv: chainAtmCall?.impliedVolatility ?? 0,
    };
  });

  // Greeks at ATM
  const T = nearest ? nearest.daysToExpiry / 365 : 0.1;
  const iv = atmIv > 0 ? atmIv : 0.3;

  const greeksSummary = {
    atmDelta: delta(spot, atmStrike, T, riskFreeRate, iv, "call"),
    atmGamma: gamma(spot, atmStrike, T, riskFreeRate, iv),
    atmTheta: theta(spot, atmStrike, T, riskFreeRate, iv, "call"),
    atmVega: vega(spot, atmStrike, T, riskFreeRate, iv),
  };

  return {
    expectedMove: em,
    putCallRatio: pcr,
    ivSkew: skew,
    maxPain: mp,
    atmIv,
    historicalVolatility: hv,
    unusualActivity: ua,
    termStructure,
    greeksSummary,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run lib/finance/options-analysis.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add lib/finance/options-analysis.ts lib/finance/options-analysis.test.ts
git commit -m "feat(options): add options signal analysis engine with tests"
```

---

### Task 3: Yahoo Finance Options Fetcher + Risk-Free Rate

**Files:**
- Create: `lib/market/yahoo-options.ts`

**Interfaces:**
- Consumes:
  - `OptionsContract`, `OptionsChain`, `OptionsSnapshot` from `lib/market/types-options.ts`
  - `getYahooCrumb()` pattern from `lib/market/yahoo.ts` (reuse the exported crumb/cookie auth — if `getYahooCrumb` is not exported, the implementer should export it)
  - `getQuote(ticker)` from `lib/market/yahoo.ts`
  - `getOrFetch` from `lib/cache/index.ts`
  - `RFR_TTL` from `lib/cache/freshness.ts`
- Produces:
  - `getOptionsChain(ticker: string, expiry?: number): Promise<RawOptionsResponse>`
  - `getAllNearTermChains(ticker: string): Promise<OptionsSnapshot>`
  - `getRiskFreeRate(supabase: SupabaseClient): Promise<number>`

- [ ] **Step 1: Check if `getYahooCrumb` is exported**

Read `lib/market/yahoo.ts` and check whether `getYahooCrumb` is exported. If not, add `export` to the function declaration. The v7 options endpoint may or may not need crumb auth — try without first, fall back to with crumb.

- [ ] **Step 2: Implement Yahoo options fetcher**

Create `lib/market/yahoo-options.ts`:

```typescript
import type { OptionsContract, OptionsChain, OptionsSnapshot } from "./types-options";
import { getOrFetch } from "@/lib/cache";
import { RFR_TTL } from "@/lib/cache/freshness";
import { getQuote } from "./yahoo";
import type { SupabaseClient } from "@supabase/supabase-js";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface YahooOptionContract {
  strike?: number;
  bid?: number;
  ask?: number;
  lastPrice?: number;
  volume?: number;
  openInterest?: number;
  impliedVolatility?: number;
  inTheMoney?: boolean;
}

interface YahooOptionsResult {
  underlyingSymbol?: string;
  expirationDates?: number[];
  strikes?: number[];
  quote?: { regularMarketPrice?: number };
  options?: Array<{
    expirationDate?: number;
    calls?: YahooOptionContract[];
    puts?: YahooOptionContract[];
  }>;
}

interface YahooOptionsResponse {
  optionChain: {
    result: YahooOptionsResult[] | null;
    error: { code?: string; description?: string } | null;
  };
}

function mapContract(
  raw: YahooOptionContract,
  type: "call" | "put",
  expiryIso: string
): OptionsContract {
  return {
    strike: raw.strike ?? 0,
    bid: raw.bid ?? null,
    ask: raw.ask ?? null,
    lastPrice: raw.lastPrice ?? null,
    volume: raw.volume ?? 0,
    openInterest: raw.openInterest ?? 0,
    impliedVolatility: raw.impliedVolatility ?? null,
    inTheMoney: raw.inTheMoney ?? false,
    contractType: type,
    expiry: expiryIso,
  };
}

function unixToIso(unix: number): string {
  return new Date(unix * 1000).toISOString().split("T")[0];
}

function daysUntil(isoDate: string): number {
  const now = new Date();
  const target = new Date(isoDate);
  return Math.max(0, Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
}

async function fetchOptionsPage(
  ticker: string,
  expiry?: number
): Promise<YahooOptionsResult> {
  let url = `https://query1.finance.yahoo.com/v7/finance/options/${encodeURIComponent(ticker)}`;
  if (expiry != null) {
    url += `?date=${expiry}`;
  }

  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance options request failed for "${ticker}" with status ${response.status}`
    );
  }

  const json = (await response.json()) as YahooOptionsResponse;

  if (json.optionChain.error) {
    throw new Error(
      `Yahoo Finance options error for "${ticker}": ${
        json.optionChain.error.description ?? json.optionChain.error.code ?? "unknown"
      }`
    );
  }

  const result = json.optionChain.result?.[0];
  if (!result) {
    throw new Error(`No options data returned for "${ticker}"`);
  }

  return result;
}

function parseChain(result: YahooOptionsResult): OptionsChain | null {
  const optData = result.options?.[0];
  if (!optData || optData.expirationDate == null) return null;

  const expiryIso = unixToIso(optData.expirationDate);

  return {
    expiryDate: expiryIso,
    daysToExpiry: daysUntil(expiryIso),
    calls: (optData.calls ?? []).map((c) => mapContract(c, "call", expiryIso)),
    puts: (optData.puts ?? []).map((p) => mapContract(p, "put", expiryIso)),
  };
}

export async function getAllNearTermChains(
  ticker: string
): Promise<OptionsSnapshot> {
  // First fetch: get nearest expiry chain + all available expiry timestamps
  const firstResult = await fetchOptionsPage(ticker);

  const underlyingPrice =
    firstResult.quote?.regularMarketPrice ?? 0;
  const allExpiries = firstResult.expirationDates ?? [];

  const chains: OptionsChain[] = [];

  // Parse the first (nearest) chain
  const firstChain = parseChain(firstResult);
  if (firstChain) chains.push(firstChain);

  // Fetch next 3 closest expiries in parallel
  const usedExpiry = firstResult.options?.[0]?.expirationDate;
  const remainingExpiries = allExpiries
    .filter((e) => e !== usedExpiry)
    .slice(0, 3);

  const additionalResults = await Promise.all(
    remainingExpiries.map((exp) => fetchOptionsPage(ticker, exp).catch(() => null))
  );

  for (const res of additionalResults) {
    if (!res) continue;
    const chain = parseChain(res);
    if (chain) chains.push(chain);
  }

  return {
    ticker,
    underlyingPrice,
    chains,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getRiskFreeRate(
  supabase: SupabaseClient
): Promise<number> {
  const { data } = await getOrFetch<number>(
    supabase,
    "rfr-irx",
    "risk-free-rate",
    RFR_TTL,
    async () => {
      const quote = await getQuote("^IRX");
      // ^IRX returns yield as percentage (e.g. 5.25), convert to decimal
      return (quote.price ?? 5.0) / 100;
    },
    { shared: true }
  );

  return data;
}
```

- [ ] **Step 3: Export `getYahooCrumb` from `yahoo.ts` if not already exported**

Check `lib/market/yahoo.ts` — if `getYahooCrumb` is not exported, add `export` to its declaration. (It may not be needed for v7, but export it for future use.)

- [ ] **Step 4: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/market/yahoo-options.ts lib/market/yahoo.ts
git commit -m "feat(options): add Yahoo Finance options chain fetcher and risk-free rate"
```

---

### Task 4: AI Options Analysis Module

**Files:**
- Create: `lib/ai/options-analysis.ts`

**Interfaces:**
- Consumes:
  - `OptionsSignals` from `lib/market/types-options.ts`
  - `generateCompletion(system, user, "gemini")` from `lib/ai/client.ts`
- Produces:
  - `generateOptionsAnalysis(signals, quoteContext, fundamentalsContext): Promise<OptionsAnalysisText>`

Where:
```typescript
interface QuoteContext {
  price: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface FundamentalsContext {
  nextEarningsDate: string | null;
  consensusEps: number | null;
}

interface OptionsAnalysisText {
  marketPositioning: string;
  expectedMoveAnalysis: string;
  volatilityAssessment: string;
  notableFlow: string;
  keyRisksAndCatalysts: string;
  actionableTakeaway: string;
}
```

- [ ] **Step 1: Implement AI options analysis module**

Create `lib/ai/options-analysis.ts`:

```typescript
import { generateCompletion } from "./client";
import type { OptionsSignals } from "@/lib/market/types-options";

const OPTIONS_SYSTEM_PROMPT = `You are a senior equity analyst at a top-tier investment bank. You use the options market as a sentiment indicator to understand what institutional investors and market makers are pricing in about a stock's future. You are NOT providing options trading advice — you are reading the options market to inform an equity view.

Rules:
- Write with conviction. No hedging language ("could potentially", "might be").
- Cite specific numbers: expected move %, IV levels, put/call ratios, volume/OI ratios.
- Connect options signals to fundamental catalysts (earnings, macro, sector rotation).
- When unusual activity exists, interpret what the bet implies about expectations.
- Compare implied volatility to historical volatility — state whether options are pricing more or less risk than realized.
- If term structure shows a spike at a specific expiry, identify what event is being priced there.

Respond with valid JSON matching this exact structure (no markdown, no code fences, just raw JSON):
{
  "marketPositioning": "2-4 sentences on overall sentiment from aggregate flow, skew, and put/call ratio",
  "expectedMoveAnalysis": "2-4 sentences on the priced-in move vs historical context",
  "volatilityAssessment": "2-4 sentences on IV vs historical vol, term structure shape, IV crush risk",
  "notableFlow": "2-4 sentences interpreting unusual activity and what those bets suggest",
  "keyRisksAndCatalysts": "2-4 sentences on what the options market is hedging or speculating on",
  "actionableTakeaway": "1-2 sentences — concise bottom line for an equity investor"
}`;

interface QuoteContext {
  price: number;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
}

interface FundamentalsContext {
  nextEarningsDate: string | null;
  consensusEps: number | null;
}

export interface OptionsAnalysisText {
  marketPositioning: string;
  expectedMoveAnalysis: string;
  volatilityAssessment: string;
  notableFlow: string;
  keyRisksAndCatalysts: string;
  actionableTakeaway: string;
}

function formatSignalsForPrompt(
  ticker: string,
  signals: OptionsSignals,
  quote: QuoteContext,
  fundamentals: FundamentalsContext | null
): string {
  const lines: string[] = [
    `## Options Analysis Data for ${ticker}`,
    ``,
    `**Current Price:** $${quote.price.toFixed(2)}`,
  ];

  if (quote.fiftyTwoWeekHigh != null && quote.fiftyTwoWeekLow != null) {
    lines.push(
      `**52-Week Range:** $${quote.fiftyTwoWeekLow.toFixed(2)} — $${quote.fiftyTwoWeekHigh.toFixed(2)}`
    );
  }

  if (fundamentals?.nextEarningsDate) {
    lines.push(`**Next Earnings Date:** ${fundamentals.nextEarningsDate}`);
  }
  if (fundamentals?.consensusEps != null) {
    lines.push(`**Consensus EPS:** $${fundamentals.consensusEps.toFixed(2)}`);
  }

  lines.push(``);
  lines.push(`### Pre-Computed Options Signals`);
  lines.push(``);
  lines.push(
    `**Expected Move (nearest expiry):** $${signals.expectedMove.dollars.toFixed(2)} (${signals.expectedMove.percent.toFixed(1)}%)`
  );
  lines.push(
    `**Expected Range:** $${signals.expectedMove.lowerBound.toFixed(2)} — $${signals.expectedMove.upperBound.toFixed(2)}`
  );
  lines.push(`**Put/Call Ratio:** ${isFinite(signals.putCallRatio) ? signals.putCallRatio.toFixed(2) : "N/A (no call volume)"}`);
  lines.push(
    `**IV Skew:** ${signals.ivSkew.direction} (magnitude: ${(signals.ivSkew.magnitude * 100).toFixed(1)}%)`
  );
  lines.push(`**ATM Implied Volatility:** ${(signals.atmIv * 100).toFixed(1)}%`);
  lines.push(
    `**Historical Volatility (30d):** ${(signals.historicalVolatility * 100).toFixed(1)}%`
  );
  lines.push(
    `**IV vs HV:** ${signals.atmIv > signals.historicalVolatility ? "IV is ELEVATED above realized vol" : "IV is BELOW realized vol"} (spread: ${(Math.abs(signals.atmIv - signals.historicalVolatility) * 100).toFixed(1)}%)`
  );
  lines.push(`**Max Pain:** $${signals.maxPain.toFixed(2)}`);

  lines.push(``);
  lines.push(`### IV Term Structure (ATM IV by Expiry)`);
  for (const ts of signals.termStructure) {
    lines.push(`- ${ts.expiry} (${ts.daysToExpiry}d): ${(ts.atmIv * 100).toFixed(1)}%`);
  }

  lines.push(``);
  lines.push(`### Greeks at ATM Strike`);
  lines.push(`- Delta: ${signals.greeksSummary.atmDelta.toFixed(4)}`);
  lines.push(`- Gamma: ${signals.greeksSummary.atmGamma.toFixed(4)}`);
  lines.push(`- Theta: $${signals.greeksSummary.atmTheta.toFixed(4)}/day`);
  lines.push(`- Vega: $${signals.greeksSummary.atmVega.toFixed(4)}/1% IV`);

  if (signals.unusualActivity.length > 0) {
    lines.push(``);
    lines.push(`### Unusual Activity (Volume > 2x Open Interest)`);
    for (const ua of signals.unusualActivity) {
      lines.push(
        `- ${ua.type.toUpperCase()} $${ua.strike} exp ${ua.expiry}: vol=${ua.volume}, OI=${ua.openInterest}, ratio=${ua.volumeOiRatio.toFixed(1)}x`
      );
    }
  } else {
    lines.push(``);
    lines.push(`### Unusual Activity: None detected`);
  }

  return lines.join("\n");
}

export async function generateOptionsAnalysis(
  ticker: string,
  signals: OptionsSignals,
  quote: QuoteContext,
  fundamentals: FundamentalsContext | null
): Promise<OptionsAnalysisText> {
  const userPrompt = formatSignalsForPrompt(ticker, signals, quote, fundamentals);

  const raw = await generateCompletion(
    OPTIONS_SYSTEM_PROMPT,
    userPrompt,
    "gemini"
  );

  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

  const parsed = JSON.parse(cleaned) as OptionsAnalysisText;

  return {
    marketPositioning: parsed.marketPositioning ?? "",
    expectedMoveAnalysis: parsed.expectedMoveAnalysis ?? "",
    volatilityAssessment: parsed.volatilityAssessment ?? "",
    notableFlow: parsed.notableFlow ?? "",
    keyRisksAndCatalysts: parsed.keyRisksAndCatalysts ?? "",
    actionableTakeaway: parsed.actionableTakeaway ?? "",
  };
}
```

- [ ] **Step 2: Run full test suite to verify no regressions**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add lib/ai/options-analysis.ts
git commit -m "feat(options): add AI options analysis module with Gemini prompt"
```

---

### Task 5: Options Analysis API Route

**Files:**
- Create: `app/api/market/options-analysis/route.ts`

**Interfaces:**
- Consumes:
  - `getAllNearTermChains(ticker)` from `lib/market/yahoo-options.ts`
  - `getRiskFreeRate(supabase)` from `lib/market/yahoo-options.ts`
  - `computeOptionsSignals(snapshot, rfr, priceHistory)` from `lib/finance/options-analysis.ts`
  - `ivSurface(chains, spotPrice)` from `lib/finance/options-analysis.ts`
  - `generateOptionsAnalysis(ticker, signals, quoteContext, fundamentalsContext)` from `lib/ai/options-analysis.ts`
  - `getOrFetch<T>` from `lib/cache/index.ts`
  - `OPTIONS_TTL` from `lib/cache/freshness.ts`
  - `getHistorical(ticker, "1d", "3mo")` from `lib/market/yahoo.ts`
  - `getTickerFundamentals(ticker)` from `lib/market/yahoo.ts` (via shared cache)
  - `OptionsAnalysisResponse` from `lib/market/types-options.ts`
  - `createClient` from `@/lib/supabase/server`
- Produces: `GET /api/market/options-analysis?ticker=AAPL` → `OptionsAnalysisResponse`

- [ ] **Step 1: Implement the API route**

Create `app/api/market/options-analysis/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOrFetch } from "@/lib/cache";
import { OPTIONS_TTL, THESIS_TTL } from "@/lib/cache/freshness";
import { getAllNearTermChains, getRiskFreeRate } from "@/lib/market/yahoo-options";
import { getHistorical, getTickerFundamentals } from "@/lib/market/yahoo";
import {
  computeOptionsSignals,
  ivSurface,
} from "@/lib/finance/options-analysis";
import { generateOptionsAnalysis } from "@/lib/ai/options-analysis";
import type { OptionsAnalysisResponse } from "@/lib/market/types-options";
import type { TickerFundamentals } from "@/lib/market/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: claimsData, error: authError } =
      await supabase.auth.getClaims();

    if (authError || !claimsData?.claims?.sub) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const ticker = request.nextUrl.searchParams
      .get("ticker")
      ?.trim()
      .toUpperCase();
    if (!ticker) {
      return NextResponse.json(
        { error: "ticker parameter is required" },
        { status: 400 }
      );
    }

    const { data } = await getOrFetch<OptionsAnalysisResponse>(
      supabase,
      `options-analysis-${ticker}`,
      "options-analysis",
      OPTIONS_TTL,
      async () => {
        // Fetch all data in parallel
        const [snapshot, rfr, historical, fundamentals] = await Promise.all([
          getAllNearTermChains(ticker),
          getRiskFreeRate(supabase),
          getHistorical(ticker, "1d", "3mo").catch(() => []),
          getOrFetch<TickerFundamentals>(
            supabase,
            `fundamentals-${ticker}`,
            "fundamentals",
            THESIS_TTL,
            () => getTickerFundamentals(ticker),
            { shared: true }
          )
            .then((r) => r.data)
            .catch(() => null),
        ]);

        const priceHistory = historical.map((bar) => bar.close);
        const signals = computeOptionsSignals(snapshot, rfr, priceHistory);
        const surface = ivSurface(snapshot.chains, snapshot.underlyingPrice);

        const quoteContext = {
          price: snapshot.underlyingPrice,
          fiftyTwoWeekHigh: fundamentals?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: fundamentals?.fiftyTwoWeekLow ?? null,
        };

        const fundamentalsContext = fundamentals
          ? {
              nextEarningsDate: fundamentals.nextEarningsDate,
              consensusEps:
                fundamentals.earningsTrend.find((e) => e.period === "0q")
                  ?.epsEstimate ?? null,
            }
          : null;

        const analysis = await generateOptionsAnalysis(
          ticker,
          signals,
          quoteContext,
          fundamentalsContext
        );

        // Build positioning data for nearest expiry
        const nearest = snapshot.chains[0];
        const positioning = nearest
          ? [...new Set([
              ...nearest.calls.map((c) => c.strike),
              ...nearest.puts.map((p) => p.strike),
            ])]
              .sort((a, b) => a - b)
              .filter((strike) => {
                const pct =
                  Math.abs(strike - snapshot.underlyingPrice) /
                  snapshot.underlyingPrice;
                return pct <= 0.15;
              })
              .map((strike) => ({
                strike,
                callVolume:
                  nearest.calls.find((c) => c.strike === strike)?.volume ?? 0,
                putVolume:
                  nearest.puts.find((p) => p.strike === strike)?.volume ?? 0,
                callOI:
                  nearest.calls.find((c) => c.strike === strike)
                    ?.openInterest ?? 0,
                putOI:
                  nearest.puts.find((p) => p.strike === strike)
                    ?.openInterest ?? 0,
              }))
          : [];

        return {
          ticker,
          underlyingPrice: snapshot.underlyingPrice,
          signals,
          analysis,
          ivSurface: surface,
          ivTermStructure: signals.termStructure,
          positioning,
          expectedMove: signals.expectedMove,
          maxPain: signals.maxPain,
          putCallRatio: signals.putCallRatio,
        } satisfies OptionsAnalysisResponse;
      },
      { shared: true }
    );

    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to fetch options analysis: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Run linter**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add app/api/market/options-analysis/route.ts
git commit -m "feat(options): add options analysis API route with shared cache"
```

---

### Task 6: Options Tab UI + Docs

**Files:**
- Modify: `app/watchlist/ticker-detail-panel.tsx`
- Modify: `DECISIONS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes:
  - `OptionsAnalysisResponse`, `IvSurfacePoint`, `ExpectedMove` from `lib/market/types-options.ts`
  - API route: `GET /api/market/options-analysis?ticker=AAPL` → `OptionsAnalysisResponse`
- Produces: Options tab UI in the detail panel (6th tab)

- [ ] **Step 1: Add Options tab type and state**

In `app/watchlist/ticker-detail-panel.tsx`:

Update the `Tab` type to include `"options"`:
```typescript
type Tab = "overview" | "news" | "sentiment" | "thesis" | "earnings" | "options";
```

Add the tab button to the tab bar (after the Earnings tab):
```typescript
{ id: "options" as Tab, label: "Options" },
```

Add state variables:
```typescript
const [optionsData, setOptionsData] = useState<OptionsAnalysisData | null>(null);
const [optionsFetched, setOptionsFetched] = useState(false);
const [optionsError, setOptionsError] = useState<string | null>(null);
```

Add a local interface for the response (do not import from types-options, follow the pattern of other tabs which define local interfaces):

```typescript
interface OptionsAnalysisData {
  ticker: string;
  underlyingPrice: number;
  signals: {
    expectedMove: { dollars: number; percent: number; upperBound: number; lowerBound: number };
    putCallRatio: number;
    ivSkew: { direction: string; magnitude: number };
    maxPain: number;
    atmIv: number;
    historicalVolatility: number;
    unusualActivity: Array<{
      strike: number;
      expiry: string;
      type: string;
      volume: number;
      openInterest: number;
      volumeOiRatio: number;
    }>;
    termStructure: Array<{ expiry: string; daysToExpiry: number; atmIv: number }>;
    greeksSummary: { atmDelta: number; atmGamma: number; atmTheta: number; atmVega: number };
  };
  analysis: {
    marketPositioning: string;
    expectedMoveAnalysis: string;
    volatilityAssessment: string;
    notableFlow: string;
    keyRisksAndCatalysts: string;
    actionableTakeaway: string;
  };
  ivSurface: Array<{ moneyness: number; iv: number; expiry: string }>;
  ivTermStructure: Array<{ expiry: string; daysToExpiry: number; atmIv: number }>;
  positioning: Array<{
    strike: number;
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
  }>;
  expectedMove: { dollars: number; percent: number; upperBound: number; lowerBound: number };
  maxPain: number;
  putCallRatio: number;
}
```

Reset state on ticker change (add to the existing `useEffect` that resets state):
```typescript
setOptionsData(null);
setOptionsFetched(false);
setOptionsError(null);
```

Add lazy-load `useEffect`:
```typescript
useEffect(() => {
  if (activeTab !== "options" || optionsFetched) return;
  setOptionsFetched(true);

  fetch(`/api/market/options-analysis?ticker=${encodeURIComponent(ticker)}`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((data: OptionsAnalysisData) => setOptionsData(data))
    .catch((err) => setOptionsError(err instanceof Error ? err.message : String(err)));
}, [activeTab, optionsFetched, ticker]);
```

- [ ] **Step 2: Add Recharts imports**

Add to existing Recharts imports at the top (some may already be imported — only add missing ones):
```typescript
import {
  LineChart,
  Line,
  // BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  // ResponsiveContainer, ComposedChart, Cell — likely already imported from earnings tab
  Legend,
  ReferenceLine,
} from "recharts";
```

- [ ] **Step 3: Implement the Options tab content**

Add the `activeTab === "options"` render branch. Five sections:

**Section A: AI Analysis** — 6 collapsible sections with headers. Each starts expanded. Use the same card styling as the thesis tab.

**Section B: Expected Move Gauge** — A horizontal bar showing the current price, expected range (shaded region), and max pain marker. Use a single Recharts BarChart or a custom div-based bar.

**Section C: IV Surface Chart** — `LineChart` with moneyness on x-axis, IV% on y-axis, one `Line` per expiry. Group `ivSurface` data by expiry.

**Section D: IV Term Structure** — `LineChart` with expiry dates on x-axis, ATM IV% on y-axis. Single line. If next earnings date is available, add a `ReferenceLine` at that date.

**Section E: Positioning by Strike** — `BarChart` with strikes on x-axis, grouped bars for call volume (green) and put volume (red). `ReferenceLine` at max pain strike.

Follow the same styling patterns as the Earnings tab: zinc/dark background cards, Tailwind text colors, `ResponsiveContainer` wrappers, `RechartsTooltip` with dark theme formatters, skeleton loading, error state.

- [ ] **Step 4: Add Decision to DECISIONS.md**

Add Decision 54:

```markdown
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
```

- [ ] **Step 5: Update CLAUDE.md**

Add to the Key Files section:
```
- `lib/finance/black-scholes.ts` — Black-Scholes pricing, Greeks, IV solver
- `lib/finance/options-analysis.ts` — options signal computation (expected move, skew, max pain, etc.)
- `lib/market/yahoo-options.ts` — Yahoo Finance v7 options chain fetcher + risk-free rate
- `lib/ai/options-analysis.ts` — Gemini-powered options market narrative
- `app/api/market/options-analysis/route.ts` — options analysis API (shared cache, 4hr TTL)
```

- [ ] **Step 6: Run linter**

Run: `npm run lint`
Expected: No errors (fix any `react-hooks/purity` or typing issues)

- [ ] **Step 7: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 8: Commit**

```bash
git add app/watchlist/ticker-detail-panel.tsx DECISIONS.md CLAUDE.md
git commit -m "feat(options): add Options tab with AI analysis, IV surface, term structure, positioning charts"
```
