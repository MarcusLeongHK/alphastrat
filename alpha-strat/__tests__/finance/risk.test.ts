import { describe, it, expect } from 'vitest';
import { calcBeta, calcSharpeRatio, calcCAGR } from '@/lib/finance/risk';

describe('calcBeta', () => {
  it('returns 1.0 for identical arrays', () => {
    const returns = [0.01, 0.02, -0.01, 0.03, -0.02];
    expect(calcBeta(returns, returns)).toBeCloseTo(1.0, 5);
  });

  it('returns NaN for mismatched lengths', () => {
    expect(calcBeta([0.01, 0.02], [0.01])).toBeNaN();
  });

  it('returns NaN for arrays that are too short', () => {
    expect(calcBeta([0.01], [0.01])).toBeNaN();
  });

  it('returns NaN for empty arrays', () => {
    expect(calcBeta([], [])).toBeNaN();
  });
});

describe('calcCAGR', () => {
  it('calculates CAGR for $100 to $200 over 5 years', () => {
    expect(calcCAGR(100, 200, 5)).toBeCloseTo(0.1487, 4);
  });
});

describe('calcSharpeRatio', () => {
  it('calculates Sharpe ratio with known values', () => {
    const returns = [0.01, 0.02, 0.015, 0.005, 0.01];
    const riskFreeRate = 0.001;
    const result = calcSharpeRatio(returns, riskFreeRate);
    expect(result).not.toBeNaN();
    expect(typeof result).toBe('number');
  });

  it('returns NaN for empty array', () => {
    expect(calcSharpeRatio([], 0.001)).toBeNaN();
  });

  it('returns NaN for single element array', () => {
    expect(calcSharpeRatio([0.01], 0.001)).toBeNaN();
  });
});
