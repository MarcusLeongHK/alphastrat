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
import { EmptyState } from "@/app/components/ui/empty-state";

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
        className="text-sm text-danger hover:opacity-80 disabled:opacity-50"
      >
        {isPending ? "..." : "Delete"}
      </button>
      {state.error && (
        <span className="ml-2 text-xs text-danger">{state.error}</span>
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
    <tr className="border-b border-border-primary bg-surface-tertiary">
      <td colSpan={colSpan} className="py-3 pl-6 pr-4">
        <form action={formAction} className="flex flex-wrap items-center gap-3">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="type" value={type} />
          <div className="flex rounded-md border border-border-secondary text-sm">
            <button
              type="button"
              onClick={() => setType("buy")}
              className={`px-3 py-1 rounded-l-md ${
                type === "buy"
                  ? "bg-success text-white"
                  : "bg-transparent text-text-secondary"
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => setType("sell")}
              className={`px-3 py-1 rounded-r-md ${
                type === "sell"
                  ? "bg-danger text-white"
                  : "bg-transparent text-text-secondary"
              }`}
            >
              Sell
            </button>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            Quantity
            <input
              type="number"
              name="quantity"
              required
              min="0.0001"
              step="any"
              className="w-24 rounded border border-border-primary bg-surface-primary px-2 py-1 text-sm text-text-primary tabular-nums focus:border-accent focus:outline-none"
            />
          </label>
          {type === "buy" && (
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              Cost Basis
              <input
                type="number"
                name="cost_basis"
                required
                min="0.01"
                step="0.01"
                className="w-24 rounded border border-border-primary bg-surface-primary px-2 py-1 text-sm text-text-primary tabular-nums focus:border-accent focus:outline-none"
              />
            </label>
          )}
          {type === "sell" && (
            <label className="flex items-center gap-1.5 text-xs text-text-secondary">
              Sell Price
              <input
                type="number"
                name="sell_price"
                required
                min="0.01"
                step="0.01"
                className="w-24 rounded border border-border-primary bg-surface-primary px-2 py-1 text-sm text-text-primary tabular-nums focus:border-accent focus:outline-none"
              />
            </label>
          )}
          <label className="flex items-center gap-1.5 text-xs text-text-secondary">
            Date
            <input
              type="date"
              name="transacted_at"
              max={today}
              className="w-36 rounded border border-border-primary bg-surface-primary px-2 py-1 text-sm text-text-primary tabular-nums focus:border-accent focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-accent px-3 py-1 text-sm font-medium text-white disabled:opacity-50"
          >
            {isPending ? "..." : type === "buy" ? "Buy" : "Sell"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          {state.error && (
            <span className="text-xs text-danger">{state.error}</span>
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
  if (value > 0) return "text-success";
  if (value < 0) return "text-danger";
  return "text-text-secondary";
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
      <EmptyState
        title="No positions yet"
        description="Add a position above to start tracking your portfolio."
      />
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
          <tr className="border-b border-border-primary">
            <th className="pb-2 pr-4 text-left font-medium text-text-secondary">
              Ticker
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
              Shares
            </th>
            <th className="hidden md:table-cell pb-2 pr-4 text-right font-medium text-text-secondary">
              Cost Basis
            </th>
            <th className="hidden md:table-cell pb-2 pr-4 text-right font-medium text-text-secondary">
              Total Cost
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
              Current Price
            </th>
            <th className="hidden md:table-cell pb-2 pr-4 text-right font-medium text-text-secondary">
              Market Value
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
              P/L ($)
            </th>
            <th className="pb-2 pr-4 text-right font-medium text-text-secondary">
              P/L (%)
            </th>
            <th className="pb-2 text-right font-medium text-text-secondary"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ position: p, currentPrice, marketValue, pnl, pnlPercent }) => {
            const isClosed = p.quantity === 0;
            const isExpanded = expandedPositionId === p.id;
            const mutedText = isClosed
              ? "text-text-tertiary"
              : "text-text-secondary";

            return (
              <Fragment key={p.id}>
                <tr className="border-b border-border-primary">
                  <td
                    className={`py-3 pr-4 font-mono font-medium ${
                      isClosed ? "text-text-tertiary" : "text-text-primary"
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
                        className={`inline-block text-xs text-text-tertiary transition-transform duration-200 ${
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
                  <td className={`hidden md:table-cell py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    ${p.cost_basis.toFixed(2)}
                  </td>
                  <td className={`hidden md:table-cell py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    ${(p.quantity * p.cost_basis).toFixed(2)}
                  </td>
                  <td className={`py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    {currentPrice !== null ? `$${currentPrice.toFixed(2)}` : "—"}
                  </td>
                  <td className={`hidden md:table-cell py-3 pr-4 text-right tabular-nums ${mutedText}`}>
                    {marketValue !== null ? `$${formatUsd(marketValue)}` : "—"}
                  </td>
                  <td
                    className={`py-3 pr-4 text-right tabular-nums ${
                      isClosed
                        ? mutedText
                        : pnl !== null
                        ? pnlColor(pnl)
                        : "text-text-secondary"
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
                        : "text-text-secondary"
                    }`}
                  >
                    {pnlPercent !== null
                      ? `${pnlPercent >= 0 ? "+" : ""}${pnlPercent.toFixed(2)}%`
                      : "—"}
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-3">
                      {isClosed ? (
                        <span className="rounded bg-surface-tertiary px-1.5 py-0.5 text-xs font-medium text-text-secondary">
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
                          className="text-sm text-text-secondary hover:text-text-primary"
                        >
                          {openTransactionId === p.id ? "Close" : "Add Transaction"}
                        </button>
                      )}
                      <DeleteButton id={p.id} />
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="border-b border-border-primary">
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
          <tr className="border-t border-border-primary font-medium">
            <td className="pt-3 pr-4 text-text-primary">Total</td>
            <td className="pt-3 pr-4"></td>
            <td className="hidden md:table-cell pt-3 pr-4"></td>
            <td className="hidden md:table-cell pt-3 pr-4 text-right tabular-nums text-text-primary">
              ${formatUsd(totalCost)}
            </td>
            <td className="pt-3 pr-4"></td>
            <td className="hidden md:table-cell pt-3 pr-4 text-right tabular-nums text-text-primary">
              {hasAnyPrice ? `$${formatUsd(totalMarketValue)}` : "—"}
            </td>
            <td
              className={`pt-3 pr-4 text-right tabular-nums ${
                hasAnyPrice ? pnlColor(totalPnl) : "text-text-primary"
              }`}
            >
              {hasAnyPrice
                ? `${totalPnl >= 0 ? "+" : ""}$${formatUsd(totalPnl)}`
                : "—"}
            </td>
            <td
              className={`pt-3 pr-4 text-right tabular-nums ${
                hasAnyPrice ? pnlColor(totalPnlPercent) : "text-text-primary"
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
