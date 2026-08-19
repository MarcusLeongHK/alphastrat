import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: string;
}

export function Card({ children, className = "", hover = false, padding = "p-4 md:p-5" }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border-primary bg-surface-secondary ${padding} ${
        hover
          ? "transition-all duration-150 hover:-translate-y-px hover:border-border-secondary"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
