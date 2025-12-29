"use client";

import * as React from "react";

import type { LrtScheduleResponse } from "@/lib/eta/lrt";
import type { LrtStationSearchItem, UiLanguage } from "@/lib/eta/types";

export function useLrtSchedule(params: { stations: LrtStationSearchItem[]; lang: UiLanguage }) {
  const { stations, lang } = params;

  const [stationId, setStationId] = React.useState<string | undefined>(undefined);
  const [schedule, setSchedule] = React.useState<LrtScheduleResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null);
  const [stale, setStale] = React.useState(false);

  const refresh = React.useCallback(
    async (options?: { toastOnError?: boolean }) => {
      if (!stationId) return;
     setLoading(true);
     try {
       setError(null);

      const response = await fetch(
        `/api/lrt/schedule?stationId=${encodeURIComponent(stationId)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load schedule: ${response.status}`);
      }

       const json = (await response.json()) as { schedule: LrtScheduleResponse };
       setSchedule(json.schedule);
       setLastUpdatedAt(Date.now());
       setStale(false);
     } catch (error) {
       const message = error instanceof Error ? error.message : "Failed to load schedule";
       setError(message);
       setStale(true);
       if (options?.toastOnError) {
         const { toast } = await import("sonner");
         toast.error(message);
       }
     } finally {
       setLoading(false);
     }
   },
   [stationId]
 );


  React.useEffect(() => {
    if (!stationId) return;
     void refresh({ toastOnError: false });
   }, [refresh, stationId]);


  const title = React.useMemo(() => {
    if (!stationId) return "Light Rail";
    const station = stations.find((s) => s.stationId === stationId);
    if (station) return lang === "en" ? station.nameEn : station.nameZh;
    return `Station ${stationId}`;
  }, [lang, stationId, stations]);

  return {
    stationId,
    setStationId,
    schedule,
    loading,
    error,
    stale,
    lastUpdatedAt,
    refresh,
    title,
  };
}
