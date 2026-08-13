"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthResult } from "@/app/auth/actions";

const initialState: AuthResult = {};

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signup, initialState);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">
        Create an account
      </h1>
      {state.success ? (
        <div className="mt-8 w-full rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950">
          <p className="text-sm text-emerald-800 dark:text-emerald-200">
            {state.message}
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Back to login
          </Link>
        </div>
      ) : (
        <>
          <form action={formAction} className="mt-8 w-full space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </div>
            {state.error && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.error}
              </p>
            )}
            <button
              type="submit"
              disabled={isPending}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              {isPending ? "Creating account..." : "Sign up"}
            </button>
          </form>
          <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
            >
              Log in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
