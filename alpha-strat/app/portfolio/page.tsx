import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Position } from "@/lib/types";
import { AddPositionForm } from "./add-position-form";
import { PortfolioDashboard } from "./portfolio-dashboard";
import { SectionHeader } from "@/app/components/ui/section-header";

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
    <div className="mx-auto w-full max-w-5xl px-4 py-8 md:px-6">
      <SectionHeader
        title="Portfolio"
        description="Track your positions and see how your portfolio is allocated."
      />

      <section className="mt-6">
        <SectionHeader title="Add Position" />
        <div className="mt-4">
          <AddPositionForm />
        </div>
      </section>

      <section className="mt-8">
        <SectionHeader title="Your Positions" />
        <div className="mt-4">
          <PortfolioDashboard positions={(positions as Position[]) ?? []} />
        </div>
      </section>
    </div>
  );
}
