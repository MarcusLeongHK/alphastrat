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
