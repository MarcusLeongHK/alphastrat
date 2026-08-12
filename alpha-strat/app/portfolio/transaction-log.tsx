"use client";

import { useEffect, useState } from "react";
import type { Transaction } from "@/lib/types";

interface TransactionLogProps {
  positionId: string;
  refreshKey?: number;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function TypeBadge({ type }: { type: "buy" | "sell" }) {
  if (type === "buy") {
    return (
      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
        Buy
      </span>
    );
  }
  return (
    <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
      Sell
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="py-2 pr-4">
            <div className="h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
          </td>
          <td className="py-2 pr-4">
            <div className="h-3 w-10 rounded bg-zinc-200 dark:bg-zinc-800" />
          </td>
          <td className="py-2 pr-4">
            <div className="ml-auto h-3 w-12 rounded bg-zinc-200 dark:bg-zinc-800" />
          </td>
          <td className="py-2 pr-4">
            <div className="ml-auto h-3 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
          </td>
          <td className="py-2">
            <div className="ml-auto h-3 w-14 rounded bg-zinc-200 dark:bg-zinc-800" />
          </td>
        </tr>
      ))}
    </>
  );
}

export function TransactionLog({ positionId, refreshKey }: TransactionLogProps) {
  const [transactions, setTransactions] = useState<Transaction[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/portfolio/transactions?position_id=${encodeURIComponent(
            positionId
          )}`
        );
        if (!res.ok) {
          throw new Error("Failed to load transactions.");
        }
        const data = (await res.json()) as Transaction[];
        if (!cancelled) {
          setTransactions(data);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load transactions.");
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [positionId, refreshKey]);

  return (
    <div className="rounded-md bg-zinc-50 px-4 py-3 dark:bg-zinc-900/50">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-1.5 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Date
            </th>
            <th className="pb-1.5 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Type
            </th>
            <th className="pb-1.5 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Shares
            </th>
            <th className="pb-1.5 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Price/Share
            </th>
            <th className="pb-1.5 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {transactions === null && !error && <SkeletonRows />}
          {error && (
            <tr>
              <td colSpan={5} className="py-2 text-red-500">
                {error}
              </td>
            </tr>
          )}
          {transactions !== null && transactions.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="py-2 text-zinc-500 dark:text-zinc-400"
              >
                No transactions recorded.
              </td>
            </tr>
          )}
          {transactions !== null &&
            transactions.map((t) => (
              <tr
                key={t.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
              >
                <td className="py-1.5 pr-4 text-zinc-600 dark:text-zinc-400">
                  {formatDate(t.transacted_at)}
                </td>
                <td className="py-1.5 pr-4">
                  <TypeBadge type={t.type} />
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  {t.quantity}
                </td>
                <td className="py-1.5 pr-4 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  ${t.price_per_share.toFixed(2)}
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-700 dark:text-zinc-300">
                  ${(t.quantity * t.price_per_share).toFixed(2)}
                </td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}
