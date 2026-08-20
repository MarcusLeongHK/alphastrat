"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signup, type AuthResult } from "@/app/auth/actions";

const initialState: AuthResult = {};

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signup, initialState);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="w-full rounded-xl border border-border-primary bg-surface-secondary p-6">
        <h1 className="text-xl font-semibold text-text-primary">
          Create an account
        </h1>
        {state.success ? (
          <div className="mt-8 w-full rounded-lg border border-success/30 bg-success/10 p-4">
            <p className="text-sm text-success">{state.message}</p>
            <Link
              href="/login"
              className="mt-3 inline-block text-sm font-medium text-success hover:underline"
            >
              Back to login
            </Link>
          </div>
        ) : (
          <form action={formAction} className="mt-8 w-full space-y-4">
            <div>
              <label
                htmlFor="accessCode"
                className="block text-sm font-medium text-text-secondary"
              >
                Access Code
              </label>
              <input
                id="accessCode"
                name="accessCode"
                type="text"
                required
                autoComplete="off"
                placeholder="Enter your access code"
                className="mt-1 w-full rounded-lg border border-border-primary bg-surface-primary px-3 py-2 text-sm uppercase text-text-primary placeholder:normal-case placeholder:text-text-tertiary focus:border-accent focus:outline-none"
              />
            </div>
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
                autoComplete="new-password"
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
              {isPending ? "Creating account..." : "Sign up"}
            </button>
          </form>
        )}
      </div>
      {!state.success && (
        <p className="mt-6 text-sm text-text-tertiary">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </p>
      )}
    </div>
  );
}
