import type { ReactNode } from "react";

type BadgeVariant = "bullish" | "bearish" | "neutral" | "mixed" | "info";

interface BadgeProps {
  variant: BadgeVariant;
  children: ReactNode;
  size?: "sm" | "md";
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  bullish: "bg-success/15 text-success",
  bearish: "bg-danger/15 text-danger",
  neutral: "bg-surface-tertiary text-text-secondary",
  mixed: "bg-warning/15 text-warning",
  info: "bg-accent-muted text-accent",
};

export function Badge({ variant, children, size = "sm" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${VARIANT_STYLES[variant]} ${
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
      }`}
    >
      {children}
    </span>
  );
}
