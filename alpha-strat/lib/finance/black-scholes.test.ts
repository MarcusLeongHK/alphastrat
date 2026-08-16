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
