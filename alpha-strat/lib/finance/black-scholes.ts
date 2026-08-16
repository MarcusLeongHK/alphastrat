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

  // Abramowitz & Stegun 7.1.26 approximates erf(z), so transform via
  // z = |x| / sqrt(2) and Phi(x) = 0.5 * (1 + erf(x / sqrt(2))).
  const sign = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1.0 / (1.0 + p * z);
  const erf =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

  return 0.5 * (1.0 + sign * erf);
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
