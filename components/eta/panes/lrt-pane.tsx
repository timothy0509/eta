"use client";

import * as React from "react";

import { LrtStationSearch } from "@/components/eta/lrt-stop-search";
import { useLrtSchedule } from "@/lib/eta/use-lrt-schedule";
import type { LrtStationSearchItem, UiLanguage } from "@/lib/eta/types";
import type { FavoritesItem } from "@/lib/store";

export type LrtPaneState = {
  title: string;
  lang: UiLanguage;
  schedule: ReturnType<typeof useLrtSchedule>["schedule"];
  onRefresh: () => void;
  loading: boolean;
};

type Props = {
  lang: UiLanguage;
  stations: LrtStationSearchItem[];
  onAddRecent: (item: FavoritesItem) => void;
  onAddFavorite: (item: FavoritesItem) => void;
  canFavoriteRef: React.MutableRefObject<boolean>;
  onRegisterRefresh: (refresh: () => Promise<void>) => void;
  selectedItem?: FavoritesItem | null;
  onStateChange?: (state: LrtPaneState) => void;
};

export function LrtPane({
  lang,
  stations,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  onRegisterRefresh,
  selectedItem,
  onStateChange,
}: Props) {
  const { stationId, setStationId, schedule, loading, refresh, title } = useLrtSchedule({
    stations,
    lang,
  });

  React.useEffect(() => {
    onRegisterRefresh(refresh);
  }, [onRegisterRefresh, refresh]);

  const paneState = React.useMemo<LrtPaneState>(
    () => ({
      title,
      lang,
      schedule,
      loading,
      onRefresh: () => void refresh(),
    }),
    [lang, loading, refresh, schedule, title]
  );

  React.useEffect(() => {
    onStateChange?.(paneState);
  }, [onStateChange, paneState]);

  React.useEffect(() => {
    if (!selectedItem || selectedItem.mode !== "lrt") return;
    setStationId(selectedItem.stationId);
  }, [selectedItem, setStationId]);

  React.useEffect(() => {
    canFavoriteRef.current = Boolean(stationId);
  }, [canFavoriteRef, stationId]);

  const onSave = () => {
    if (!stationId) return;
    const station = stations.find((s) => s.stationId === stationId);
    const name = station ? (lang === "en" ? station.nameEn : station.nameZh) : "";
    const title = station ? `${name} · ${station.stationId}` : `LRT · ${stationId}`;

    const item: FavoritesItem = {
      id: `lrt:${stationId}`,
      mode: "lrt",
      title,
      stationId,
    };

    onAddFavorite(item);
    onAddRecent(item);
  };

  return (
    <div className="space-y-4">
      <LrtStationSearch
        lang={lang}
        stations={stations}
        selectedStationId={stationId}
        onSelect={(station) => {
          setStationId(station.stationId);
          onAddRecent({
            id: `lrt:${station.stationId}`,
            mode: "lrt",
            title: `${lang === "en" ? station.nameEn : station.nameZh} · ${station.stationId}`,
            stationId: station.stationId,
          });
          void refresh();
        }}
      />

      <div className="flex items-center gap-2">
        <button
          className="rounded-xl border bg-card px-3 py-2 text-sm"
          onClick={() => void onSave()}
          disabled={!stationId}
        >
          Save
        </button>
      </div>
    </div>
  );
}
