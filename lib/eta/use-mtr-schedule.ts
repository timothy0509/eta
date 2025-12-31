"use client";

import * as React from "react";

import type { MtrScheduleResponse } from "@/lib/eta/mtr";
import type { MtrStationSearchItem, UiLanguage } from "@/lib/eta/types";
import { fetchMtrSchedules } from "@/lib/eta/client";

export function useMtrSchedule(params: {
  lang: UiLanguage;
  stations: MtrStationSearchItem[];
}) {
  const { lang, stations } = params;

  const [sta, setSta] = React.useState<string | undefined>(undefined);
  const [schedule, setSchedule] = React.useState<MtrScheduleResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null);
  const [stale, setStale] = React.useState(false);

  // AbortController for cancelling in-flight requests
  const abortControllerRef = React.useRef<AbortController | null>(null);

  const refresh = React.useCallback(
    async (options?: { toastOnError?: boolean }) => {
      if (!sta) return;

      const station = stations.find((s) => s.sta === sta);
      if (!station) return;

      // Cancel any in-flight request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      try {
        setError(null);
        const mtrLang = lang === "en" ? "EN" : "TC";

        // Use the new batched endpoint - one request for all lines at this station
        const queries = station.lines.map((line) => ({
          line,
          sta,
          lang: mtrLang as "EN" | "TC",
        }));

        const result = await fetchMtrSchedules(queries, { signal: controller.signal });

        if (controller.signal.aborted) return;

        // Merge schedules from all lines
        let baseline: MtrScheduleResponse | null = null;
        const mergedData: Record<string, NonNullable<MtrScheduleResponse["data"]>[string]> = {};

        for (const [key, item] of Object.entries(result.byKey)) {
          baseline ??= item;
          if (item.status !== 1) continue;
          Object.assign(mergedData, item.data ?? {});
        }

        if (!baseline) {
          setSchedule(null);
          return;
        }

        setSchedule({
          ...baseline,
          status: Object.keys(mergedData).length ? 1 : baseline.status,
          data: Object.keys(mergedData).length ? mergedData : baseline.data,
        });
        setLastUpdatedAt(Date.now());
        setStale(false);

        // Warn if we hit rate limiting
        if (result.backoff) {
          console.warn("[MTR] Rate limited - using cached data");
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        const message = error instanceof Error ? error.message : "Failed to load schedule";
        setError(message);
        setStale(true);
        if (options?.toastOnError) {
          const { toast } = await import("sonner");
          toast.error(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [lang, sta, stations]
  );

  // Cleanup abort controller on unmount
  React.useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  React.useEffect(() => {
    if (!sta) return;
    void refresh({ toastOnError: false });
  }, [refresh, sta]);

  const title = React.useMemo(() => {
    if (!sta) return "MTR";
    const station = stations.find((s) => s.sta === sta);
    return station ? (lang === "en" ? station.nameEn : station.nameTc) : `Station ${sta}`;
  }, [lang, sta, stations]);

  return {
    sta,
    setSta,
    schedule,
    loading,
    error,
    stale,
    lastUpdatedAt,
    refresh,
    title,
  };
}
