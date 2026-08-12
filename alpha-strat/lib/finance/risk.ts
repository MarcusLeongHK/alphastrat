function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function variance(values: number[]): number {
  const m = mean(values);
  return values.reduce((sum, v) => sum + (v - m) ** 2, 0) / values.length;
}

function stddev(values: number[]): number {
  return Math.sqrt(variance(values));
}

function covariance(a: number[], b: number[]): number {
  const meanA = mean(a);
  const meanB = mean(b);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += (a[i] - meanA) * (b[i] - meanB);
  }
  return sum / a.length;
}

export function calcBeta(stockReturns: number[], benchmarkReturns: number[]): number {
  if (stockReturns.length !== benchmarkReturns.length || stockReturns.length < 2) {
    return NaN;
  }
  return covariance(stockReturns, benchmarkReturns) / variance(benchmarkReturns);
}

export function calcSharpeRatio(returns: number[], riskFreeRate: number): number {
  if (returns.length < 2) {
    return NaN;
  }
  const excessMean = mean(returns) - riskFreeRate;
  const sd = stddev(returns);
  return (excessMean / sd) * Math.sqrt(252);
}

export function calcCAGR(startValue: number, endValue: number, years: number): number {
  return (endValue / startValue) ** (1 / years) - 1;
}
