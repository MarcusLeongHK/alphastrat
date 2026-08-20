"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

interface AllocationChartProps {
  data: { ticker: string; weight: number; marketValue: number }[];
}

const COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#6366f1",
  "#e11d48",
  "#64748b",
];

interface TooltipPayloadItem {
  payload: { ticker: string; weight: number; marketValue: number };
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || payload.length === 0) return null;

  const { ticker, weight, marketValue } = payload[0].payload;

  return (
    <div className="rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm shadow-sm">
      <p className="font-mono font-medium text-text-primary">{ticker}</p>
      <p className="tabular-nums text-text-secondary">
        {(weight * 100).toFixed(1)}%
      </p>
      <p className="tabular-nums text-text-secondary">
        $
        {marketValue.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  );
}

function renderLabel(props: unknown) {
  const { ticker, weight } = props as { ticker: string; weight: number };
  if (weight <= 0.05) return "";
  return ticker;
}

export function AllocationChart({ data }: AllocationChartProps) {
  if (data.length === 0) {
    return (
      <p className="text-sm text-text-secondary">
        No allocation data available.
      </p>
    );
  }

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="weight"
            nameKey="ticker"
            cx="50%"
            cy="50%"
            outerRadius={100}
            label={renderLabel}
          >
            {data.map((entry, index) => (
              <Cell
                key={entry.ticker}
                fill={COLORS[index % COLORS.length]}
              />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
