"use client";

import { useActionState } from "react";
import Link from "next/link";
import { login, type AuthResult } from "@/app/auth/actions";

const initialState: AuthResult = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full rounded-xl border border-border-primary bg-surface-secondary p-6">
        <h1 className="text-xl font-semibold text-text-primary">
          Log in to AlphaStrat
        </h1>
        <form action={formAction} className="mt-8 w-full space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-text-secondary"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-text-secondary"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={6}
              autoComplete="current-password"
              className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent focus:outline-none"
            />
          </div>
          {state.error && (
            <p className="text-sm text-danger">{state.error}</p>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-all hover:bg-accent/90 active:scale-[0.98] disabled:opacity-50"
          >
            {isPending ? "Logging in..." : "Log in"}
          </button>
        </form>
      </div>
      <p className="mt-6 text-sm text-text-tertiary">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
