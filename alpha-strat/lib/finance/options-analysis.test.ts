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
