"use client";

import { Heart, History, Trash2 } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LRT_STATIONS, type LrtStation } from "@/lib/data/lrt-stations";
import { MTR_STATIONS, type MtrStation } from "@/lib/data/mtr-stations";
import { getLineColor } from "@/lib/eta/line-colors";
import { parseKmbStopName } from "@/lib/eta/kmb-stop-name";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { useAppStore, type FavoritesItem } from "@/lib/store";

type Props = {
  lang: UiLanguage;
  kmbStops?: KmbStopSearchItem[];
  onSelect: (item: FavoritesItem) => void;
};


function pickKmbStopTitle(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "en") return stop.nameEn;
  if (lang === "sc") return stop.nameSc;
  return stop.nameTc;
}

/**
 * Generate display content for a favorite item based on current language.
 */
function FavoriteItemDisplay({
  item,
  lang,
  kmbStopsById,
  kmbStopIndexById,
  mtrStationsBySta,
  lrtStationsById,
}: {
  item: FavoritesItem;
  lang: UiLanguage;
  kmbStopsById: Map<string, KmbStopSearchItem>;
  kmbStopIndexById: Map<string, number>;
  mtrStationsBySta: Map<string, MtrStation>;
  lrtStationsById: Map<string, LrtStation>;
}) {
  if (item.mode === "mtr") {
    const station = mtrStationsBySta.get(item.sta);
    if (!station) return <span>{item.title}</span>;

    const name = lang === "en" ? station.nameEn : station.nameTc;
    return (
      <span className="flex items-center gap-1.5">
        <span className="truncate">{name}</span>
        <span className="flex shrink-0 items-center gap-0.5">
          {station.lines.map((line) => (
            <span
              key={line}
              className="inline-flex h-4 items-center rounded px-1 text-[10px] font-semibold text-white"
              style={{ backgroundColor: getLineColor(line) }}
            >
              {line}
            </span>
          ))}
        </span>
      </span>
    );
  }

  if (item.mode === "lrt") {
    const station = lrtStationsById.get(item.stationId);
    if (!station) return <span>{item.title}</span>;

    const name = lang === "en" ? station.nameEn : station.nameZh;
    return <span className="truncate">{name}</span>;
  }

  // KMB mode - regenerate title based on current language
  if (item.mode === "kmb") {
    // For "contains" queries, keep the static title
    if ("query" in item) {
      return <span className="truncate">{item.title}</span>;
    }

    // Single stop
    if ("stopId" in item) {
      const stop = kmbStopsById.get(item.stopId);
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang);
        const { name } = parseKmbStopName(fullName);
        
        // Build suffix from saved data
        let suffix = "";
        if (item.routeFilterMode === "advanced" && item.entries?.length) {
          const count = item.entries.length;
          suffix = ` · ${count} ${
            lang === "en" ? (count === 1 ? "route" : "routes") : "條路線"
          }`;
        } else if (item.route) {
          suffix = ` · ${item.route}`;
        }
        
        return <span className="truncate">{name}{suffix}</span>;
      }
    }

    // Grouped stops
    if ("stopIds" in item) {
      let firstStop: KmbStopSearchItem | undefined;
      let firstStopIndex = Number.POSITIVE_INFINITY;
      for (const stopId of item.stopIds) {
        const index = kmbStopIndexById.get(stopId);
        if (index !== undefined && index < firstStopIndex) {
          const candidate = kmbStopsById.get(stopId);
          if (candidate) {
            firstStop = candidate;
            firstStopIndex = index;
          }
        }
      }
      if (firstStop) {
        const fullName = pickKmbStopTitle(firstStop, lang);
        const { name } = parseKmbStopName(fullName);
        
        // Build suffix from saved data
        let suffix = "";
        if (item.routeFilterMode === "advanced" && item.entries?.length) {
          const count = item.entries.length;
          suffix = ` · ${count} ${
            lang === "en" ? (count === 1 ? "route" : "routes") : "條路線"
          }`;
        } else if (item.route) {
          suffix = ` · ${item.route}`;
        }
        
        return <span className="truncate">{name}{suffix}</span>;
      }
    }

  }

  // Fallback to stored title
  return <span className="truncate">{item.title}</span>;
}

export function FavoritesAndRecents({ lang, kmbStops, onSelect }: Props) {
  const favorites = useAppStore((s) => s.favorites);
  const recents = useAppStore((s) => s.recents);
  const removeFavorite = useAppStore((s) => s.removeFavorite);
  const clearRecents = useAppStore((s) => s.clearRecents);

  const mtrStationsBySta = React.useMemo(() => {
    return new Map(MTR_STATIONS.map((station) => [station.sta, station]));
  }, []);

  const lrtStationsById = React.useMemo(() => {
    return new Map(LRT_STATIONS.map((station) => [station.stationId, station]));
  }, []);

  const kmbStopsById = React.useMemo(() => {
    if (!kmbStops) return new Map<string, KmbStopSearchItem>();
    return new Map(kmbStops.map((stop) => [stop.stopId, stop]));
  }, [kmbStops]);

  const kmbStopIndexById = React.useMemo(() => {
    if (!kmbStops) return new Map<string, number>();
    return new Map(kmbStops.map((stop, index) => [stop.stopId, index]));
  }, [kmbStops]);

  const t = {
    saved: lang === "en" ? "Saved" : lang === "sc" ? "已儲存" : "已儲存",
    favorites: lang === "en" ? "Favorites" : "收藏",
    recent: lang === "en" ? "Recent" : "最近",
    noFavorites: lang === "en" ? "No favorites yet." : lang === "sc" ? "暫無收藏。" : "暫無收藏。",
    tip: lang === "en" ? "Tip: results can auto-refresh while you wait." : lang === "sc" ? "提示：結果可在等待時自動刷新。" : "提示：結果可在等待時自動刷新。",
    clear: lang === "en" ? "Clear" : "清除",
    noRecent: lang === "en" ? "No recent searches." : lang === "sc" ? "暫無搜尋記錄。" : "暫無搜尋記錄。",
  };

  return (
    <Card className="rounded-3xl">
      <Tabs defaultValue="favorites" className="gap-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{t.saved}</CardTitle>
          <TabsList withIndicator>
            <TabsTrigger value="favorites" unstyledActive className="gap-2">
              <Heart className="h-4 w-4" /> {t.favorites}
            </TabsTrigger>
            <TabsTrigger value="recent" unstyledActive className="gap-2">
              <History className="h-4 w-4" /> {t.recent}
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <TabsContent value="favorites" className="mt-0 p-6 pt-0">
            <div className="space-y-2">
              {favorites.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t.noFavorites}</div>
              ) : (
                favorites.map((f) => (
                  <div
                    key={f.id}
                    className="ui-animate-in-fast ui-lift flex items-center justify-between gap-2 rounded-2xl border bg-background/40 px-3 py-2"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelect(f)}
                    >
                      <div className="text-sm font-medium">
                        <FavoriteItemDisplay
                          item={f}
                          lang={lang}
                          kmbStopsById={kmbStopsById}
                          kmbStopIndexById={kmbStopIndexById}
                          mtrStationsBySta={mtrStationsBySta}
                          lrtStationsById={lrtStationsById}
                        />
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {f.mode.toUpperCase()}
                      </div>
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="rounded-xl"
                      onClick={() => removeFavorite(f.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="recent" className="mt-0 p-6 pt-0">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {t.tip}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecents}
                  className="rounded-xl"
                  disabled={!recents.length}
                >
                  {t.clear}
                </Button>
              </div>

              {recents.length === 0 ? (
                <div className="text-sm text-muted-foreground">{t.noRecent}</div>
              ) : (
                recents.map((r) => (
                  <button
                    key={`${r.id}-${r.at}`}
                    className="ui-animate-in-fast ui-lift w-full rounded-2xl border bg-background/40 px-3 py-2 text-left hover:bg-background/60"
                    onClick={() => onSelect(r)}
                  >
                     <div className="text-sm font-medium">
                        <FavoriteItemDisplay
                          item={r}
                          lang={lang}
                          kmbStopsById={kmbStopsById}
                          kmbStopIndexById={kmbStopIndexById}
                          mtrStationsBySta={mtrStationsBySta}
                          lrtStationsById={lrtStationsById}
                        />
                     </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{r.mode.toUpperCase()}</span>
                      <span>{new Date(r.at).toLocaleString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>

            <Separator className="my-2" />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );

}
