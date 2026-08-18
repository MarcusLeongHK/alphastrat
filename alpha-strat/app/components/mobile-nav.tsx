"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface MobileNavProps {
  user: { email: string } | null;
  logoutAction: () => Promise<void>;
}

const NAV_LINKS = [
  { href: "/watchlist", label: "Watchlist" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/macro", label: "Macro" },
];

export function MobileNav({ user, logoutAction }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

  // Lock body scroll while the panel is open.
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-11 w-11 flex-col items-center justify-center gap-1.5"
      >
        <span
          className={`h-0.5 w-6 bg-zinc-900 transition-transform duration-200 dark:bg-zinc-100 ${
            open ? "translate-y-2 rotate-45" : ""
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-zinc-900 transition-opacity duration-200 dark:bg-zinc-100 ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-zinc-900 transition-transform duration-200 dark:bg-zinc-100 ${
            open ? "-translate-y-2 -rotate-45" : ""
          }`}
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu backdrop"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-black/50"
          />
          <div className="pt-safe-top fixed inset-y-0 right-0 z-40 flex w-64 flex-col border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <nav className="flex flex-1 flex-col gap-1 p-4">
              {user ? (
                <>
                  {NAV_LINKS.map((link) => {
                    const isActive = pathname === link.href;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        className={`flex min-h-11 items-center rounded px-3 text-sm font-medium ${
                          isActive
                            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                            : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                        }`}
                      >
                        {link.label}
                      </Link>
                    );
                  })}
                  <div className="mt-auto flex flex-col gap-1 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                    <span className="flex min-h-11 items-center px-3 text-sm text-zinc-500 dark:text-zinc-400">
                      {user.email}
                    </span>
                    <form action={logoutAction}>
                      <button
                        type="submit"
                        className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                      >
                        Log out
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex min-h-11 items-center rounded px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  Log in
                </Link>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
