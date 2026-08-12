export const PORTFOLIO_SUMMARY_SYSTEM = `You are a portfolio analyst assistant for a personal finance app. Given a user's portfolio positions and risk metrics, write a concise 2-3 sentence summary describing the portfolio's style, concentration, and risk profile. Be factual and direct. Do not give personalized investment advice or recommendations to buy or sell. Do not use markdown formatting.`;

interface PositionSummaryInput {
  ticker: string;
  quantity: number;
  costBasis: number;
  currentPrice: number;
  weight: number;
  pnlPercent: number;
}

interface MetricsSummaryInput {
  beta: number;
  sharpe: number;
  cagr: number;
}

export function buildPortfolioSummaryPrompt(
  positions: PositionSummaryInput[],
  metrics: MetricsSummaryInput
): string {
  const positionLines = positions
    .map(
      (p) =>
        `- ${p.ticker}: ${p.quantity} shares @ cost basis $${p.costBasis.toFixed(
          2
        )}, current price $${p.currentPrice.toFixed(2)}, ${(
          p.weight * 100
        ).toFixed(1)}% of portfolio, P/L ${p.pnlPercent >= 0 ? "+" : ""}${p.pnlPercent.toFixed(
          1
        )}%`
    )
    .join("\n");

  return `Portfolio positions:\n${positionLines}\n\nRisk metrics:\n- Beta: ${metrics.beta.toFixed(
    2
  )}\n- Sharpe ratio: ${metrics.sharpe.toFixed(2)}\n- CAGR: ${(
    metrics.cagr * 100
  ).toFixed(1)}%\n\nSummarize this portfolio's style and risk profile in 2-3 sentences.`;
}
