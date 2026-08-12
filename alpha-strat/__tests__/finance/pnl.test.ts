import { describe, it, expect } from 'vitest';
import { calcUnrealizedPnL, calcPnLPercent, calcTotalMarketValue } from '@/lib/finance/pnl';

describe('calcUnrealizedPnL', () => {
  it('calculates positive PnL for 10 shares bought at $100, current $150', () => {
    expect(calcUnrealizedPnL(100, 10, 150)).toBe(500);
  });

  it('calculates negative PnL', () => {
    expect(calcUnrealizedPnL(100, 10, 80)).toBe(-200);
  });
});

describe('calcPnLPercent', () => {
  it('calculates 50% for cost $100, current $150', () => {
    expect(calcPnLPercent(100, 150)).toBe(50);
  });

  it('calculates negative percent', () => {
    expect(calcPnLPercent(100, 80)).toBe(-20);
  });
});

describe('calcTotalMarketValue', () => {
  it('calculates market value', () => {
    expect(calcTotalMarketValue(10, 150)).toBe(1500);
  });
});
