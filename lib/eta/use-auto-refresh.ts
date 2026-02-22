"use client";

import * as React from "react";

/**
 * Add jitter to refresh intervals to prevent synchronized bursts.
 * Returns a value between 0.9x and 1.1x of the base interval.
 */
function addJitter(baseMs: number): number {
  const jitterFactor = 0.9 + Math.random() * 0.2; // 0.9 to 1.1
  return Math.round(baseMs * jitterFactor);
}

export function useAutoRefresh(refreshMs: number, refresh: () => void) {
  React.useEffect(() => {
    if (!refreshMs) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;

    let lastRefreshTime = Date.now();

    const refreshWithTimestamp = () => {
      refresh();
      lastRefreshTime = Date.now();
    };

    const scheduleNext = () => {
      // Add jitter to each interval to prevent synchronized refreshes
      const nextMs = addJitter(refreshMs);
      timeout = setTimeout(() => {
        if (document.visibilityState === "visible") {
          refreshWithTimestamp();
        }
        scheduleNext();
      }, nextMs);
    };

    scheduleNext();

    // Handle visibility change - refresh immediately when tab becomes visible
    // but only if enough time has passed since last refresh
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastRefreshTime;
        // Only refresh if at least 30% of the interval has passed
        if (elapsed > refreshMs * 0.3) {
          refreshWithTimestamp();
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timeout) clearTimeout(timeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshMs, refresh]);
}
