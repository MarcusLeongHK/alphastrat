import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { WatchlistItem } from "@/lib/types";
import { AddTickerForm } from "./add-ticker-form";
import { WatchlistDashboard } from "./watchlist-dashboard";

export default async function WatchlistPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: watchlist } = await supabase
    .from("watchlist")
    .select("*")
    .order("added_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Watchlist
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Track tickers and upcoming earnings.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Add Ticker
        </h2>
        <div className="mt-4">
          <AddTickerForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Your Watchlist
        </h2>
        <div className="mt-4">
          <WatchlistDashboard
            items={(watchlist as WatchlistItem[]) ?? []}
          />
        </div>
      </section>
    </div>
  );
}
