"use client";

import * as React from "react";

import type { MtrScheduleResponse } from "@/lib/eta/mtr";
import type { MtrStationSearchItem, UiLanguage } from "@/lib/eta/types";

export function useMtrSchedule(params: {
  lang: UiLanguage;
  stations: MtrStationSearchItem[];
}) {
  const { lang, stations } = params;

  const [sta, setSta] = React.useState<string | undefined>(undefined);
  const [schedule, setSchedule] = React.useState<MtrScheduleResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!sta) return;

    const station = stations.find((s) => s.sta === sta);
    if (!station) return;

    setLoading(true);
    try {
      const mtrLang = lang === "en" ? "EN" : "TC";

      const schedules = await Promise.all(
        station.lines.map(async (line) => {
          const response = await fetch(
            `/api/mtr/schedule?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(sta)}&lang=${encodeURIComponent(mtrLang)}`
          );

          if (!response.ok) {
            throw new Error(`Failed to load schedule: ${response.status}`);
          }

          const json = (await response.json()) as { schedule: MtrScheduleResponse };
          return json.schedule;
        })
      );

      let baseline: MtrScheduleResponse | null = null;
      const mergedData: Record<string, NonNullable<MtrScheduleResponse["data"]>[string]> = {};

      for (const item of schedules) {
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
    } finally {
      setLoading(false);
    }
  }, [lang, sta, stations]);

  React.useEffect(() => {
    if (!sta) return;
    void refresh();
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
    refresh,
    title,
  };
}
