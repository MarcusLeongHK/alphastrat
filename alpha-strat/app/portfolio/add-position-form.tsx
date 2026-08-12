"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { addPosition, type ActionResult } from "./actions";

const initialState: ActionResult = {};

type TickerSuggestion = {
  symbol: string;
  name: string;
};

export function AddPositionForm() {
  const [state, formAction, isPending] = useActionState(
    addPosition,
    initialState
  );
  const formRef = useRef<HTMLFormElement>(null);
  const tickerInputRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<TickerSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
    }
  }, [state.success]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function handleTickerChange(value: string) {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (value.trim().length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/market/search?q=${encodeURIComponent(value.trim())}`
        );
        if (!res.ok) {
          setSuggestions([]);
          return;
        }
        const data = await res.json();
        const results: TickerSuggestion[] = data.results ?? [];
        setSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  }

  function handleSelectSuggestion(symbol: string) {
    if (tickerInputRef.current) {
      tickerInputRef.current.value = symbol;
    }
    setSuggestions([]);
    setShowSuggestions(false);
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="relative flex flex-col gap-1.5">
          <label
            htmlFor="ticker"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Ticker
          </label>
          <input
            ref={tickerInputRef}
            id="ticker"
            name="ticker"
            type="text"
            placeholder="AAPL"
            required
            autoComplete="off"
            defaultValue=""
            onChange={(e) => handleTickerChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            onBlur={() => {
              blurTimeoutRef.current = setTimeout(() => {
                setShowSuggestions(false);
              }, 150);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && showSuggestions && suggestions.length > 0) {
                e.preventDefault();
                handleSelectSuggestion(suggestions[0].symbol);
              }
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          />
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-900" style={{ top: "100%" }}>
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.symbol}
                  type="button"
                  onClick={() => handleSelectSuggestion(suggestion.symbol)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="font-mono font-medium text-zinc-900 dark:text-zinc-100">
                    {suggestion.symbol}
                  </span>
                  <span className="truncate text-zinc-500 dark:text-zinc-400">
                    {suggestion.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="quantity"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Shares
          </label>
          <input
            id="quantity"
            name="quantity"
            type="number"
            step="any"
            min="0.0001"
            placeholder="10"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="cost_basis"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Cost Basis ($)
          </label>
          <input
            id="cost_basis"
            name="cost_basis"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="150.00"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="transacted_at"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Date (optional)
          </label>
          <input
            id="transacted_at"
            name="transacted_at"
            type="date"
            max={today}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-400 dark:focus:ring-zinc-400"
          />
        </div>
      </div>
      {state.error && (
        <p className="text-sm text-red-600 dark:text-red-400">{state.error}</p>
      )}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isPending ? "Adding..." : "Add Position"}
      </button>
    </form>
  );
}
