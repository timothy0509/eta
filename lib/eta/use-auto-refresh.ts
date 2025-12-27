"use client";

import * as React from "react";

export function useAutoRefresh(refreshMs: number, refresh: () => void) {
  React.useEffect(() => {
    if (!refreshMs) return;

    let interval: ReturnType<typeof setInterval> | undefined;

    const start = () => {
      interval = setInterval(() => {
        if (document.visibilityState === "visible") {
          refresh();
        }
      }, refreshMs);
    };

    start();
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [refreshMs, refresh]);
}
