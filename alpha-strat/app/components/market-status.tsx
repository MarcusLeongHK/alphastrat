"use client";

import { useEffect, useState } from "react";

type MarketState = "open" | "pre" | "after" | "closed";

interface StatusInfo {
  state: MarketState;
  label: string;
  dotClassName: string;
}

const STATUS_BY_STATE: Record<MarketState, Omit<StatusInfo, "state">> = {
  open: { label: "Market Open", dotClassName: "bg-success" },
  pre: { label: "Pre-Market", dotClassName: "bg-warning" },
  after: { label: "After Hours", dotClassName: "bg-warning" },
  closed: { label: "Market Closed", dotClassName: "bg-danger" },
};

/**
 * Determines NYSE market status from the current time in US/Eastern.
 * Regular hours: Mon-Fri 9:30am-4:00pm ET.
 * Pre-market: 4:00am-9:30am ET. After-hours: 4:00pm-8:00pm ET.
 * Weekends are always closed. Holidays are NOT accounted for.
 */
function getMarketState(now: Date): MarketState {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");

  // Intl can report hour "24" for midnight depending on environment; normalize.
  const normalizedHour = hour === 24 ? 0 : hour;
  const minutesSinceMidnight = normalizedHour * 60 + minute;

  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return "closed";

  const PRE_MARKET_START = 4 * 60; // 4:00 AM
  const REGULAR_START = 9 * 60 + 30; // 9:30 AM
  const REGULAR_END = 16 * 60; // 4:00 PM
  const AFTER_HOURS_END = 20 * 60; // 8:00 PM

  if (
    minutesSinceMidnight >= REGULAR_START &&
    minutesSinceMidnight < REGULAR_END
  ) {
    return "open";
  }
  if (
    minutesSinceMidnight >= PRE_MARKET_START &&
    minutesSinceMidnight < REGULAR_START
  ) {
    return "pre";
  }
  if (
    minutesSinceMidnight >= REGULAR_END &&
    minutesSinceMidnight < AFTER_HOURS_END
  ) {
    return "after";
  }
  return "closed";
}

export function MarketStatus() {
  const [state, setState] = useState<MarketState | null>(null);

  useEffect(() => {
    const update = () => setState(getMarketState(new Date()));

    update();
    const interval = setInterval(update, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Avoid a server/client mismatch flash — render nothing until the client
  // has computed the actual state on mount.
  if (state === null) return null;

  const { label, dotClassName } = STATUS_BY_STATE[state];

  return (
    <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
      <span className={`h-2 w-2 rounded-full ${dotClassName}`} />
      {label}
    </span>
  );
}
