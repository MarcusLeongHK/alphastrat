import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/auth/actions";
import { MarketStatus } from "@/app/components/market-status";

export async function Header() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-3">
        <Link
          href="/"
          className="text-lg font-semibold text-zinc-900 dark:text-zinc-100"
        >
          AlphaStrat
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <Link
                href="/watchlist"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Watchlist
              </Link>
              <Link
                href="/portfolio"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Portfolio
              </Link>
              <Link
                href="/macro"
                className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                Macro
              </Link>
              <MarketStatus />
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {user.email}
              </span>
              <form action={logout}>
                <button
                  type="submit"
                  className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Log out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Log in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
