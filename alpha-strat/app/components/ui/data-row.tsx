interface DataRowProps {
  label: string;
  value: string | number;
  mono?: boolean;
  trend?: "up" | "down" | "neutral";
}

const TREND_COLORS: Record<string, string> = {
  up: "text-success",
  down: "text-danger",
  neutral: "text-text-primary",
};

export function DataRow({ label, value, mono = true, trend }: DataRowProps) {
  const valueColor = trend ? TREND_COLORS[trend] : "text-text-primary";
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span
        className={`text-sm font-medium ${valueColor} ${mono ? "font-mono" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
