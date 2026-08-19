"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/macro", label: "Macro" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative text-sm transition-colors ${
              isActive
                ? "font-medium text-text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {item.label}
            {isActive && (
              <span className="absolute -bottom-[13px] left-0 right-0 h-0.5 rounded-full bg-accent" />
            )}
          </Link>
        );
      })}
    </>
  );
}
