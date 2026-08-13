import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Position } from "@/lib/types";
import { AddPositionForm } from "./add-position-form";
import { PortfolioDashboard } from "./portfolio-dashboard";

export default async function PortfolioPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const { data: positions } = await supabase
    .from("positions")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Portfolio
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Track your positions and see how your portfolio is allocated.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Add Position
        </h2>
        <div className="mt-4">
          <AddPositionForm />
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
          Your Positions
        </h2>
        <div className="mt-4">
          <PortfolioDashboard positions={(positions as Position[]) ?? []} />
        </div>
      </section>
    </div>
  );
}
