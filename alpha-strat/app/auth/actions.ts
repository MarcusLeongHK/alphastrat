"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

export type AuthResult = {
  error?: string;
  success?: boolean;
  message?: string;
};

export async function signup(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;
  const accessCode = formData.get("accessCode") as string | null;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  if (!accessCode?.trim()) {
    return { error: "Access code is required." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  const supabase = await createClient();

  const { data: claimed, error: rpcError } = await supabase.rpc(
    "claim_access_code",
    { input_code: accessCode.trim() }
  );

  if (rpcError) {
    return { error: "Unable to verify access code. Please try again." };
  }

  if (!claimed) {
    return { error: "Invalid access code or code has reached its usage limit." };
  }

  const headersList = await headers();
  const origin = headersList.get("origin") ?? "http://localhost:3000";

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return {
    success: true,
    message: "Check your email for a confirmation link.",
  };
}

export async function login(
  _prev: AuthResult,
  formData: FormData
): Promise<AuthResult> {
  const email = formData.get("email") as string | null;
  const password = formData.get("password") as string | null;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect("/watchlist");
}

export async function logout(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
