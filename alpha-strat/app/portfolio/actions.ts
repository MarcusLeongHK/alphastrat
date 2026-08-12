"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getQuote } from "@/lib/market/yahoo";
import type { PositionInsert } from "@/lib/types";

export type ActionResult = {
  error?: string;
  success?: boolean;
};

export async function addPosition(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const ticker = formData.get("ticker") as string | null;
  const quantity = formData.get("quantity") as string | null;
  const costBasis = formData.get("cost_basis") as string | null;

  if (!ticker || !quantity || !costBasis) {
    return { error: "All fields are required." };
  }

  const parsedQuantity = parseFloat(quantity);
  const parsedCostBasis = parseFloat(costBasis);

  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return { error: "Quantity must be a positive number." };
  }
  if (isNaN(parsedCostBasis) || parsedCostBasis <= 0) {
    return { error: "Cost basis must be a positive number." };
  }

  const normalizedTicker = ticker.toUpperCase().trim();

  try {
    await getQuote(normalizedTicker);
  } catch {
    return { error: "Invalid ticker symbol." };
  }

  const supabase = await createClient();

  const { data: existing, error: lookupError } = await supabase
    .from("positions")
    .select("id")
    .eq("ticker", normalizedTicker)
    .maybeSingle();

  if (lookupError) {
    return { error: lookupError.message };
  }

  if (existing) {
    return {
      error: "Position already exists. Use 'Add Transaction' to add shares.",
    };
  }

  const position: PositionInsert = {
    ticker: normalizedTicker,
    quantity: parsedQuantity,
    cost_basis: parsedCostBasis,
  };

  const { error } = await supabase.from("positions").insert(position);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/portfolio");
  return { success: true };
}

export async function addTransaction(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id") as string | null;
  const type = (formData.get("type") as string | null) ?? "buy";
  const quantity = formData.get("quantity") as string | null;
  const costBasis = formData.get("cost_basis") as string | null;

  if (type !== "buy" && type !== "sell") {
    return { error: "Invalid transaction type." };
  }

  if (!id || !quantity || (type === "buy" && !costBasis)) {
    return { error: "All fields are required." };
  }

  const parsedQuantity = parseFloat(quantity);

  if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
    return { error: "Quantity must be a positive number." };
  }

  let parsedCostBasis = 0;
  if (type === "buy") {
    parsedCostBasis = parseFloat(costBasis as string);
    if (isNaN(parsedCostBasis) || parsedCostBasis <= 0) {
      return { error: "Cost basis must be a positive number." };
    }
  }

  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("positions")
    .select("quantity, cost_basis")
    .eq("id", id)
    .single();

  if (fetchError || !existing) {
    return { error: fetchError?.message ?? "Position not found." };
  }

  const oldQuantity = existing.quantity as number;
  const oldCostBasis = existing.cost_basis as number;

  if (type === "sell") {
    if (parsedQuantity > oldQuantity) {
      return { error: "Cannot sell more shares than you own." };
    }

    const newQuantity = oldQuantity - parsedQuantity;

    if (newQuantity === 0) {
      const { error } = await supabase.from("positions").delete().eq("id", id);
      if (error) {
        return { error: error.message };
      }
      revalidatePath("/portfolio");
      return { success: true };
    }

    const { error } = await supabase
      .from("positions")
      .update({ quantity: newQuantity })
      .eq("id", id);

    if (error) {
      return { error: error.message };
    }

    revalidatePath("/portfolio");
    return { success: true };
  }

  const newQuantity = oldQuantity + parsedQuantity;
  const blendedCostBasis =
    (oldQuantity * oldCostBasis + parsedQuantity * parsedCostBasis) /
    newQuantity;

  const { error } = await supabase
    .from("positions")
    .update({ quantity: newQuantity, cost_basis: blendedCostBasis })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/portfolio");
  return { success: true };
}

export async function deletePosition(
  _prev: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const id = formData.get("id") as string | null;
  if (!id) {
    return { error: "Position ID is required." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("positions").delete().eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/portfolio");
  return { success: true };
}
