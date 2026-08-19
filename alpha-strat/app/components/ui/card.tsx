import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = "", hover = false }: CardProps) {
  return (
    <div
      className={`rounded-lg border border-border-primary bg-surface-secondary p-4 md:p-5 ${
        hover
          ? "transition-all duration-150 hover:-translate-y-px hover:border-border-secondary"
          : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
