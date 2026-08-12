import { describe, it, expect } from 'vitest';
import { calcWeights } from '@/lib/finance/allocation';

describe('calcWeights', () => {
  it('splits two equal positions 50/50', () => {
    const result = calcWeights([
      { ticker: 'AAPL', quantity: 10, currentPrice: 100 },
      { ticker: 'MSFT', quantity: 10, currentPrice: 100 },
    ]);
    expect(result[0].weight).toBeCloseTo(0.5, 5);
    expect(result[1].weight).toBeCloseTo(0.5, 5);
    expect(result[0].marketValue).toBe(1000);
    expect(result[1].marketValue).toBe(1000);
  });

  it('gives 100% weight to a single position', () => {
    const result = calcWeights([{ ticker: 'AAPL', quantity: 5, currentPrice: 200 }]);
    expect(result[0].weight).toBe(1);
    expect(result[0].marketValue).toBe(1000);
  });

  it('returns empty array for empty input', () => {
    expect(calcWeights([])).toEqual([]);
  });
});
