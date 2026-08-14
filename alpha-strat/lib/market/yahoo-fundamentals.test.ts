import { describe, it, expect } from "vitest";
import { extractFundamentals } from "./yahoo";

const mockQuoteSummaryResult = {
  summaryProfile: {
    sector: "Technology",
    industry: "Consumer Electronics",
    fullTimeEmployees: 164000,
    longBusinessSummary: "Apple Inc. designs, manufactures, and markets smartphones.",
  },
  defaultKeyStatistics: {
    enterpriseValue: { raw: 3200000000000 },
    forwardPE: { raw: 28.5 },
    pegRatio: { raw: 2.1 },
    priceToBook: { raw: 45.2 },
    priceToSalesTrailing12Months: { raw: 8.3 },
    shortPercentOfFloat: { raw: 0.007 },
    sharesShort: { raw: 120000000 },
    beta: { raw: 1.24 },
    "52WeekChange": { raw: 0.15 },
    fiftyTwoWeekHigh: { raw: 237.49 },
    fiftyTwoWeekLow: { raw: 164.08 },
    trailingEps: { raw: 6.42 },
  },
  financialData: {
    currentPrice: { raw: 225.0 },
    totalRevenue: { raw: 383000000000 },
    revenueGrowth: { raw: 0.05 },
    grossMargins: { raw: 0.462 },
    operatingMargins: { raw: 0.312 },
    profitMargins: { raw: 0.263 },
    ebitda: { raw: 130000000000 },
    freeCashFlow: { raw: 111000000000 },
    operatingCashflow: { raw: 122000000000 },
    returnOnEquity: { raw: 1.47 },
    returnOnAssets: { raw: 0.22 },
    debtToEquity: { raw: 181.0 },
    currentRatio: { raw: 0.99 },
    totalCash: { raw: 62000000000 },
    totalDebt: { raw: 108000000000 },
    earningsGrowth: { raw: 0.08 },
    recommendationKey: "buy",
    recommendationMean: { raw: 2.0 },
    numberOfAnalystOpinions: { raw: 40 },
    targetMeanPrice: { raw: 240.0 },
    targetHighPrice: { raw: 280.0 },
    targetLowPrice: { raw: 190.0 },
  },
  summaryDetail: {
    marketCap: { raw: 3500000000000 },
    trailingPE: { raw: 35.0 },
  },
  earningsHistory: {
    history: [
      {
        quarter: { fmt: "4Q2025" },
        epsActual: { raw: 2.4 },
        epsEstimate: { raw: 2.35 },
        surprisePercent: { raw: 0.021 },
      },
      {
        quarter: { fmt: "3Q2025" },
        epsActual: { raw: 1.64 },
        epsEstimate: { raw: 1.59 },
        surprisePercent: { raw: 0.031 },
      },
    ],
  },
  incomeStatementHistory: {
    incomeStatementHistory: [
      {
        endDate: { fmt: "2025-12-31" },
        totalRevenue: { raw: 124000000000 },
        netIncome: { raw: 33000000000 },
      },
      {
        endDate: { fmt: "2025-09-30" },
        totalRevenue: { raw: 94000000000 },
        netIncome: { raw: 22000000000 },
      },
    ],
  },
  cashflowStatementHistory: {
    cashflowStatements: [
      {
        endDate: { fmt: "2025-12-31" },
        totalCashFromOperatingActivities: { raw: 40000000000 },
        capitalExpenditures: { raw: -3000000000 },
        freeCashFlow: { raw: 37000000000 },
      },
    ],
  },
};

describe("extractFundamentals", () => {
  it("extracts all fundamental fields from quoteSummary response", () => {
    const result = extractFundamentals("AAPL", mockQuoteSummaryResult);

    expect(result.ticker).toBe("AAPL");
    expect(result.sector).toBe("Technology");
    expect(result.industry).toBe("Consumer Electronics");
    expect(result.employees).toBe(164000);
    expect(result.description).toBe("Apple Inc. designs, manufactures, and markets smartphones.");
    expect(result.marketCap).toBe(3500000000000);
    expect(result.enterpriseValue).toBe(3200000000000);
    expect(result.trailingPE).toBe(35.0);
    expect(result.forwardPE).toBe(28.5);
    expect(result.pegRatio).toBe(2.1);
    expect(result.priceToBook).toBe(45.2);
    expect(result.priceToSales).toBe(8.3);
    expect(result.currentPrice).toBe(225.0);
    expect(result.fiftyTwoWeekHigh).toBe(237.49);
    expect(result.fiftyTwoWeekLow).toBe(164.08);
    expect(result.beta).toBe(1.24);
    expect(result.grossMargins).toBe(0.462);
    expect(result.operatingMargins).toBe(0.312);
    expect(result.profitMargins).toBe(0.263);
    expect(result.returnOnEquity).toBe(1.47);
    expect(result.returnOnAssets).toBe(0.22);
    expect(result.revenueGrowth).toBe(0.05);
    expect(result.earningsGrowth).toBe(0.08);
    expect(result.totalCash).toBe(62000000000);
    expect(result.totalDebt).toBe(108000000000);
    expect(result.debtToEquity).toBe(181.0);
    expect(result.currentRatio).toBe(0.99);
    expect(result.freeCashFlow).toBe(111000000000);
    expect(result.operatingCashFlow).toBe(122000000000);
    expect(result.shortPercentOfFloat).toBe(0.007);
    expect(result.sharesShort).toBe(120000000);
    expect(result.recommendationKey).toBe("buy");
    expect(result.targetMeanPrice).toBe(240.0);
    expect(result.numberOfAnalysts).toBe(40);

    expect(result.earningsHistory).toHaveLength(2);
    expect(result.earningsHistory[0]).toEqual({
      quarter: "4Q2025",
      epsActual: 2.4,
      epsEstimate: 2.35,
      surprisePercent: 0.021,
    });

    expect(result.quarterlyRevenue).toHaveLength(2);
    expect(result.quarterlyRevenue[0]).toEqual({
      quarter: "2025-12-31",
      revenue: 124000000000,
      netIncome: 33000000000,
    });

    expect(result.quarterlyCashFlow).toHaveLength(1);
    expect(result.quarterlyCashFlow[0]).toEqual({
      quarter: "2025-12-31",
      operatingCashFlow: 40000000000,
      capitalExpenditures: -3000000000,
      freeCashFlow: 37000000000,
    });
  });

  it("returns nulls for missing modules", () => {
    const result = extractFundamentals("ETF", {});

    expect(result.ticker).toBe("ETF");
    expect(result.sector).toBeNull();
    expect(result.marketCap).toBeNull();
    expect(result.earningsHistory).toEqual([]);
    expect(result.quarterlyRevenue).toEqual([]);
    expect(result.quarterlyCashFlow).toEqual([]);
  });
});
