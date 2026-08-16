export interface OptionsContract {
  strike: number;
  bid: number | null;
  ask: number | null;
  lastPrice: number | null;
  volume: number;
  openInterest: number;
  impliedVolatility: number | null;
  inTheMoney: boolean;
  contractType: "call" | "put";
  expiry: string; // ISO date
}

export interface OptionsChain {
  expiryDate: string; // ISO date
  daysToExpiry: number;
  calls: OptionsContract[];
  puts: OptionsContract[];
}

export interface OptionsSnapshot {
  ticker: string;
  underlyingPrice: number;
  chains: OptionsChain[];
  fetchedAt: string; // ISO timestamp
}

export interface ExpectedMove {
  dollars: number;
  percent: number;
  upperBound: number;
  lowerBound: number;
}

export interface IvSkew {
  direction: "put-heavy" | "call-heavy" | "neutral";
  magnitude: number;
}

export interface IvSurfacePoint {
  moneyness: number; // % from ATM (-20 to +20)
  iv: number;
  expiry: string;
}

export interface UnusualActivityEntry {
  strike: number;
  expiry: string;
  type: "call" | "put";
  volume: number;
  openInterest: number;
  volumeOiRatio: number;
}

export interface OptionsSignals {
  expectedMove: ExpectedMove;
  putCallRatio: number;
  ivSkew: IvSkew;
  maxPain: number;
  atmIv: number;
  historicalVolatility: number;
  unusualActivity: UnusualActivityEntry[];
  termStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  greeksSummary: {
    atmDelta: number;
    atmGamma: number;
    atmTheta: number;
    atmVega: number;
  };
}

export interface OptionsAnalysisResponse {
  ticker: string;
  underlyingPrice: number;
  signals: OptionsSignals;
  analysis: {
    marketPositioning: string;
    expectedMoveAnalysis: string;
    volatilityAssessment: string;
    notableFlow: string;
    keyRisksAndCatalysts: string;
    actionableTakeaway: string;
  };
  ivSurface: IvSurfacePoint[];
  ivTermStructure: Array<{
    expiry: string;
    daysToExpiry: number;
    atmIv: number;
  }>;
  positioning: Array<{
    strike: number;
    callVolume: number;
    putVolume: number;
    callOI: number;
    putOI: number;
  }>;
  expectedMove: ExpectedMove;
  maxPain: number;
  putCallRatio: number;
}
