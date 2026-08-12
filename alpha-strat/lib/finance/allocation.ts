export function calcWeights(
  positions: { ticker: string; quantity: number; currentPrice: number }[]
): { ticker: string; weight: number; marketValue: number }[] {
  const marketValues = positions.map((p) => p.quantity * p.currentPrice);
  const total = marketValues.reduce((sum, v) => sum + v, 0);
  return positions.map((p, i) => ({
    ticker: p.ticker,
    weight: total === 0 ? 0 : marketValues[i] / total,
    marketValue: marketValues[i],
  }));
}
