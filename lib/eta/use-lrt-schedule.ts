"use client";

import * as React from "react";

import type { LrtScheduleResponse } from "@/lib/eta/lrt";
import type { LrtStationSearchItem, UiLanguage } from "@/lib/eta/types";

export function useLrtSchedule(params: { stations: LrtStationSearchItem[]; lang: UiLanguage }) {
  const { stations, lang } = params;

  const [stationId, setStationId] = React.useState<string | undefined>(undefined);
  const [schedule, setSchedule] = React.useState<LrtScheduleResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!stationId) return;
    setLoading(true);
    try {
      const response = await fetch(
        `/api/lrt/schedule?stationId=${encodeURIComponent(stationId)}`
      );

      if (!response.ok) {
        throw new Error(`Failed to load schedule: ${response.status}`);
      }

      const json = (await response.json()) as { schedule: LrtScheduleResponse };
      setSchedule(json.schedule);
    } finally {
      setLoading(false);
    }
  }, [stationId]);

  React.useEffect(() => {
    if (!stationId) return;
    void refresh();
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
    refresh,
    title,
  };
}
