"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/market/yahoo";

export type ActionResult = {
  error?: string;
  success?: boolean;
};

export async function addToWatchlist(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in." };
  }

  const ticker = formData.get("ticker") as string | null;

  if (!ticker) {
    return { error: "Ticker is required." };
  }

  const normalizedTicker = ticker.toUpperCase().trim();

  try {
    await getQuote(normalizedTicker);
  } catch {
    return { error: "Invalid ticker symbol." };
  }

  const { error } = await supabase.from("watchlist").insert({
    user_id: user.id,
    ticker: normalizedTicker,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ticker is already in your watchlist." };
    }
    return { error: error.message };
  }

  revalidatePath("/watchlist");
  return { success: true };
}

export async function removeFromWatchlist(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be logged in." };
  }

  const id = formData.get("id") as string | null;
  if (!id) {
    return { error: "Watchlist ID is required." };
  }

  const { error } = await supabase.from("watchlist").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/watchlist");
  return { success: true };
}
