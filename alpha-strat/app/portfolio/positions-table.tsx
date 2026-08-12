"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import type { Position } from "@/lib/types";
import type { QuoteData } from "@/lib/market/types";
import {
  calcUnrealizedPnL,
  calcPnLPercent,
  calcTotalMarketValue,
} from "@/lib/finance/pnl";
import { deletePosition, addTransaction, type ActionResult } from "./actions";
import { TransactionLog } from "./transaction-log";

const initialState: ActionResult = {};

function DeleteButton({ id }: { id: string }) {
  const [state, formAction, isPending] = useActionState(
    deletePosition,
    initialState
  );

  return (
    <form action={formAction}>
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={isPending}
        className="text-sm text-red-600 hover:text-red-800 disabled:opacity-50 dark:text-red-400 dark:hover:text-red-300"
      >
        {isPending ? "..." : "Delete"}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-red-500">{state.error}</span>
      )}
    </form>
  );
}

interface AddTransactionRowProps {
  id: string;
  colSpan: number;
  onDone: () => void;
  onCancel: () => void;
}

function AddTransactionRow({
  id,
  colSpan,
  onDone,
  onCancel,
}: AddTransactionRowProps) {
  const [state, formAction, isPending] = useActionState(
    addTransaction,
    initialState
  );
  const [type, setType] = useState<"buy" | "sell">("buy");
  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (state.success) {
      onDone();
    }
  }, [state.success, onDone]);

  return (
    <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800/50 dark:bg-zinc-900/50">
      <td colSpan={colSpan} className="py-3 pl-6 pr-4">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="type" value={type} />
          <div className="flex rounded-md border border-zinc-300 text-sm dark:border-zinc-600">
            <button
              type="button"
              onClick={() => setType("buy")}
              className={`px-3 py-1 rounded-l-md ${
                type === "buy"
                  ? "bg-emerald-600 text-white"
                  : "bg-transparent text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setType("sell")}
              className={`px-3 py-1 rounded-r-md ${
                type === "sell"
                  ? "bg-red-600 text-white"
                  : "bg-transparent text-zinc-500 dark:text-zinc-400"
              }`}
            >
              Sell
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Quantity
            <input
              type="number"
              name="quantity"
              required
              min="0.0001"
              step="any"
              className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 tabular-nums focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          {type === "buy" && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Cost Basis
              <input
                type="number"
                name="cost_basis"
                required
                min="0.01"
                step="0.01"
                className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 tabular-nums focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          )}
          {type === "sell" && (
            <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              Sell Price
              <input
                type="number"
                name="sell_price"
                required
                min="0.01"
                step="0.01"
                className="w-24 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 tabular-nums focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
              />
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            Date
            <input
              type="date"
              name="transacted_at"
              max={today}
              className="w-36 rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 tabular-nums focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-zinc-900 px-3 py-1 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {isPending ? "..." : type === "buy" ? "Buy" : "Sell"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            Cancel
          </button>
          {state.error && (
            <span className="text-xs text-red-500">{state.error}</span>
          )}
        </form>
      </td>
    </tr>
  );
}

function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function pnlColor(value: number): string {
  if (value > 0) return "text-emerald-600 dark:text-emerald-400";
  if (value < 0) return "text-red-600 dark:text-red-400";
  return "text-zinc-700 dark:text-zinc-300";
}

interface PositionsTableProps {
  positions: Position[];
  quotes: QuoteData[] | null;
}

export function PositionsTable({ positions, quotes }: PositionsTableProps) {
  const [openTransactionId, setOpenTransactionId] = useState<string | null>(
    null
  );
  const [expandedPositionId, setExpandedPositionId] = useState<string | null>(
    null
  );
  const [txRefreshKey, setTxRefreshKey] = useState(0);

  if (positions.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No positions yet. Add one above to get started.
      </p>
    );
  }

  const priceByTicker = new Map(
    (quotes ?? []).map((q) => [q.ticker, q.price])
  );

  const rows = positions.map((p) => {
    const currentPrice = priceByTicker.get(p.ticker);
    const cost = p.quantity * p.cost_basis;

    if (currentPrice !== undefined) {
      const marketValue = calcTotalMarketValue(p.quantity, currentPrice);
      const pnl = calcUnrealizedPnL(p.cost_basis, p.quantity, currentPrice);
      const pnlPercent = calcPnLPercent(p.cost_basis, currentPrice);
      return { position: p, cost, currentPrice, marketValue, pnl, pnlPercent };
    }

    return {
      position: p,
      cost,
      currentPrice: null,
      marketValue: null,
      pnl: null,
      pnlPercent: null,
    };
  });

  const totals = rows.reduce(
    (acc, row) => ({
      totalCost: acc.totalCost + row.cost,
      totalMarketValue: acc.totalMarketValue + (row.marketValue ?? 0),
      totalPnl: acc.totalPnl + (row.pnl ?? 0),
      hasAnyPrice: acc.hasAnyPrice || row.currentPrice !== null,
    }),
    { totalCost: 0, totalMarketValue: 0, totalPnl: 0, hasAnyPrice: false }
  );

  const { totalCost, totalMarketValue, totalPnl, hasAnyPrice } = totals;
  const totalPnlPercent =
    totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-800">
            <th className="pb-2 pr-4 text-left font-medium text-zinc-500 dark:text-zinc-400">
              Ticker
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Shares
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Cost Basis
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Total Cost
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Current Price
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              Market Value
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              P/L ($)
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-zinc-500 dark:text-zinc-400">
              P/L (%)
            </th>
            <th className="pb-2 text-right font-medium text-zinc-500 dark:text-zinc-400"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ position: p, currentPrice, marketValue, pnl, pnlPercent }) => {
            const isClosed = p.quantity === 0;
            const isExpanded = expandedPositionId === p.id;
            const mutedText = isClosed
              ? "text-zinc-400 dark:text-zinc-600"
              : "text-zinc-700 dark:text-zinc-300";

            return (
              <Fragment key={p.id}>
                <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                  <td
                    className={`py-3 pr-4 font-mono font-medium ${
                      isClosed
                        ? "text-zinc-400 dark:text-zinc-600"
                        : "text-zinc-900 dark:text-zinc-100"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedPositionId(isExpanded ? null : p.id)
                      }
                      className="flex items-center gap-1.5"
                    >
                      <span
                        className={`inline-block text-xs text-zinc-400 transition-transform duration-200 dark:text-zinc-500 ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      >
                        ▶
                      </span>
                      {p.ticker}
                    </button>
                  </td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    {p.quantity}
                  </td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    ${p.cost_basis.toFixed(2)}
                  </td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    ${(p.quantity * p.cost_basis).toFixed(2)}
                  </td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    {marketValue !== null ? `$${formatUsd(marketValue)}` : "—"}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right tabular-nums ${
                      isClosed
                        ? mutedText
                        : pnl !== null
                        ? pnlColor(pnl)
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {pnl !== null ? `${pnl >= 0 ? "+" : ""}$${formatUsd(pnl)}` : "—"}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right tabular-nums ${
                      isClosed
                        ? mutedText
                        : pnlPercent !== null
                        ? pnlColor(pnlPercent)
                        : "text-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    {pnlPercent !== null
                      ? `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {isClosed ? (
                        <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                          Closed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            setOpenTransactionId(
                              openTransactionId === p.id ? null : p.id
                            )
                          }
                          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
                        >
                          {openTransactionId === p.id ? "Close" : "Add Transaction"}
                        </button>
                      )}
                      <DeleteButton id={p.id} />
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-zinc-100 dark:border-zinc-800/50">
                    <td colSpan={9} className="py-2 pl-6 pr-4">
                      <TransactionLog positionId={p.id} refreshKey={txRefreshKey} />
                    </td>
                  </tr>
                )}
                {openTransactionId === p.id && (
                  <AddTransactionRow
                    id={p.id}
                    colSpan={9}
                    onDone={() => {
                      setOpenTransactionId(null);
                      setTxRefreshKey((k) => k + 1);
                    }}
                    onCancel={() => setOpenTransactionId(null)}
                  />
                )}
              </Fragment>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-zinc-200 font-medium dark:border-zinc-800">
            <td className="pt-3 pr-4 text-zinc-900 dark:text-zinc-100">
              Total
            </td>
            <td className="pt-3 pr-4"></td>
            <td className="pt-3 pr-4"></td>
            <td className="pt-3 pr-4 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
              ${formatUsd(totalCost)}
            </td>
            <td className="pt-3 pr-4"></td>
            <td className="pt-3 pr-4 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
              {hasAnyPrice ? `$${formatUsd(totalMarketValue)}` : "—"}
            </td>
            <td
              className={`pt-3 pr-4 text-right tabular-nums ${
                hasAnyPrice
                  ? pnlColor(totalPnl)
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {hasAnyPrice
                ? `${totalPnl >= 0 ? "+" : ""}$${formatUsd(totalPnl)}`
                : "—"}
            </td>
            <td
              className={`pt-3 pr-4 text-right tabular-nums ${
                hasAnyPrice
                  ? pnlColor(totalPnlPercent)
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {hasAnyPrice
                ? `${totalPnlPercent >= 0 ? "+" : ""}${totalPnlPercent.toFixed(2)}%`
                : "—"}
            </td>
            <td className="pt-3"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
