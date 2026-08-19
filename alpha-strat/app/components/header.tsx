import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { MarketStatus } from "@/app/components/market-status";
import { MobileNav } from "@/app/components/mobile-nav";
import { NavLinks } from "@/app/components/nav-links";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="sticky top-0 z-50 border-b border-border-primary bg-surface-primary/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-2.5 md:px-6">
        <Link href="/" className="text-lg font-semibold text-text-primary">
          AlphaStrat
        </Link>
        <nav className="hidden items-center gap-5 md:flex">
          {user ? (
            <>
              <NavLinks />
              <MarketStatus />
              <span className="text-sm text-text-tertiary">
                {user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-sm text-text-tertiary transition-colors hover:text-text-primary"
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-text-secondary transition-colors hover:text-text-primary"
            >
              Log in
            </Link>
          )}
        </nav>
        <MobileNav
          user={user ? { email: user.email ?? "" } : null}
          logoutAction={logout}
        />
      </div>
    </header>
  );
}
