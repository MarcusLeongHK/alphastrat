export function calcUnrealizedPnL(costBasis: number, quantity: number, currentPrice: number): number {
  return (currentPrice - costBasis) * quantity;
}

export function calcPnLPercent(costBasis: number, currentPrice: number): number {
  return ((currentPrice - costBasis) / costBasis) * 100;
}

export function calcTotalMarketValue(quantity: number, currentPrice: number): number {
  return quantity * currentPrice;
}
