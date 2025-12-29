"use client";

import * as React from "react";

import { MtrStationSearch } from "@/components/eta/station-search";
import { useMtrSchedule } from "@/lib/eta/use-mtr-schedule";
import type { MtrStationSearchItem, UiLanguage } from "@/lib/eta/types";
import type { FavoritesItem } from "@/lib/store";

export type MtrPaneState = {
  title: string;
  lang: UiLanguage;
  schedule: ReturnType<typeof useMtrSchedule>["schedule"];
  onRefresh: () => void;
  loading: boolean;
};

type Props = {
  lang: UiLanguage;
  stations: MtrStationSearchItem[];
  onAddRecent: (item: FavoritesItem) => void;
  onAddFavorite: (item: FavoritesItem) => void;
  canFavoriteRef: React.MutableRefObject<boolean>;
  onRegisterRefresh: (refresh: () => Promise<void>) => void;
  selectedItem?: FavoritesItem | null;
  onStateChange?: (state: MtrPaneState) => void;
};

export function MtrPane({
  lang,
  stations,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  onRegisterRefresh,
  selectedItem,
  onStateChange,
}: Props) {
  const { sta, setSta, schedule, loading, refresh, title } = useMtrSchedule({ lang, stations });

  React.useEffect(() => {
    if (!selectedItem || selectedItem.mode !== "mtr") return;
    setSta(selectedItem.sta);
  }, [selectedItem, setSta]);

  React.useEffect(() => {
    canFavoriteRef.current = Boolean(sta);
  }, [sta, canFavoriteRef]);

  const onSave = () => {
    if (!sta) return;
    const station = stations.find((s) => s.sta === sta);
    const name = station ? (lang === "en" ? station.nameEn : station.nameTc) : "";
    const title = station ? `${name} · ${station.lines.join("/")}/${station.sta}` : `MTR · ${sta}`;

    const item: FavoritesItem = {
      id: `mtr:${sta}`,
      mode: "mtr",
      title,
      line: station?.lines[0] ?? "",
      sta,
    };

    onAddFavorite(item);
    onAddRecent(item);
  };

  const paneState = React.useMemo<MtrPaneState>(
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
    onRegisterRefresh(refresh);
  }, [onRegisterRefresh, refresh]);

  React.useEffect(() => {
    onStateChange?.(paneState);
  }, [onStateChange, paneState]);

  return (
    <div className="space-y-4">
      <MtrStationSearch
        lang={lang}
        stations={stations}
        selectedSta={sta}
        onSelect={(station) => {
          setSta(station.sta);
          const item: FavoritesItem = {
            id: `mtr:${station.sta}`,
            mode: "mtr",
            title: `${lang === "en" ? station.nameEn : station.nameTc} · ${station.lines.join("/")}/${station.sta}`,
            line: station.lines[0] ?? "",
            sta: station.sta,
          };
          onAddRecent(item);
          void refresh();
        }}
      />

      <div className="flex items-center gap-2">
        <button
          className="rounded-xl border bg-card px-3 py-2 text-sm"
          onClick={() => void onSave()}
          disabled={!sta}
        >
          {lang === "en" ? "Save" : "儲存"}
        </button>
      </div>

    </div>
  );
}
