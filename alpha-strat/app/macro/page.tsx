import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MacroDashboard } from "./macro-dashboard";

export default async function MacroPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Macro Dashboard
      </h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Cross-market news and macro outlook, refreshed hourly.
      </p>

      <div className="mt-8">
        <MacroDashboard />
      </div>
    </div>
  );
}
