"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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

function NavOverlay({
  user,
  logoutAction,
  pathname,
  onClose,
}: {
  user: { email: string } | null;
  logoutAction: () => Promise<void>;
  pathname: string;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Close menu backdrop"
        onClick={onClose}
        className="fixed inset-0 z-[60] bg-black/50"
      />
      <div className="fixed top-0 right-0 bottom-0 z-[60] flex w-64 flex-col border-l border-border-primary bg-surface-primary pt-14">
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
                        ? "bg-surface-tertiary text-text-primary"
                        : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="mt-auto flex flex-col gap-1 border-t border-border-primary pt-4">
                <span className="flex min-h-11 items-center px-3 text-sm text-text-tertiary">
                  {user.email}
                </span>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="flex min-h-11 w-full items-center rounded px-3 text-left text-sm text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                  >
                    Log out
                  </button>
                </form>
              </div>
            </>
          ) : (
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded px-3 text-sm font-medium text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </>
  );
}

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function MobileNav({ user, logoutAction }: MobileNavProps) {
  const [open, setOpen] = useState(false);
  const mounted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    if (open) setOpen(false);
  }

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
        className="relative z-[70] flex h-11 w-11 flex-col items-center justify-center gap-1.5"
      >
        <span
          className={`h-0.5 w-6 bg-text-primary transition-transform duration-200 ${
            open ? "translate-y-2 rotate-45" : ""
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-text-primary transition-opacity duration-200 ${
            open ? "opacity-0" : "opacity-100"
          }`}
        />
        <span
          className={`h-0.5 w-6 bg-text-primary transition-transform duration-200 ${
            open ? "-translate-y-2 -rotate-45" : ""
          }`}
        />
      </button>

      {open &&
        mounted &&
        createPortal(
          <NavOverlay
            user={user}
            logoutAction={logoutAction}
            pathname={pathname}
            onClose={() => setOpen(false)}
          />,
          document.body
        )}
    </div>
  );
}
