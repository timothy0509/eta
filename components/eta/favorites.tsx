"use client";

import { Heart, History, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LRT_STATIONS } from "@/lib/data/lrt-stations";
import { findMtrStationBySta } from "@/lib/data/mtr-stations";
import { getLineColor } from "@/lib/eta/line-colors";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { useAppStore, type FavoritesItem } from "@/lib/store";

type Props = {
  lang: UiLanguage;
  kmbStops?: KmbStopSearchItem[];
  onSelect: (item: FavoritesItem) => void;
};

/**
 * Parse a KMB stop name to extract the code from parentheses.
 */
function parseStopNameAndCode(fullName: string): { name: string; code: string | null } {
  const match = fullName.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s*$/);
  if (match) {
    return { name: match[1].trim(), code: match[2] };
  }
  return { name: fullName, code: null };
}

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
  kmbStops,
}: {
  item: FavoritesItem;
  lang: UiLanguage;
  kmbStops?: KmbStopSearchItem[];
}) {
  if (item.mode === "mtr") {
    const station = findMtrStationBySta(item.sta);
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
    const station = LRT_STATIONS.find((s) => s.stationId === item.stationId);
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
      const stop = kmbStops?.find((s) => s.stopId === item.stopId);
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang);
        const { name } = parseStopNameAndCode(fullName);
        
        // Build suffix from saved data
        let suffix = "";
        if (item.routeFilterMode === "advanced" && item.entries?.length) {
          const count = item.entries.length;
          suffix = ` · ${count} ${count === 1 ? "route" : "routes"}`;
        } else if (item.route) {
          suffix = ` · ${item.route}`;
        }
        
        return <span className="truncate">{name}{suffix}</span>;
      }
    }

    // Grouped stops
    if ("stopIds" in item) {
      const firstStop = kmbStops?.find((s) => item.stopIds.includes(s.stopId));
      if (firstStop) {
        const fullName = pickKmbStopTitle(firstStop, lang);
        const { name } = parseStopNameAndCode(fullName);
        
        // Build suffix from saved data
        let suffix = "";
        if (item.routeFilterMode === "advanced" && item.entries?.length) {
          const count = item.entries.length;
          suffix = ` · ${count} ${count === 1 ? "route" : "routes"}`;
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

  return (
    <Card className="rounded-3xl">
      <Tabs defaultValue="favorites" className="gap-0">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Saved</CardTitle>
          <TabsList>
            <TabsTrigger value="favorites" className="gap-2">
              <Heart className="h-4 w-4" /> Favorites
            </TabsTrigger>
            <TabsTrigger value="recent" className="gap-2">
              <History className="h-4 w-4" /> Recent
            </TabsTrigger>
          </TabsList>
        </CardHeader>

        <CardContent className="p-0">
          <TabsContent value="favorites" className="mt-0 p-6 pt-0">
            <div className="space-y-2">
              {favorites.length === 0 ? (
                <div className="text-sm text-muted-foreground">No favorites yet.</div>
              ) : (
                favorites.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-2 rounded-2xl border bg-background/40 px-3 py-2"
                  >
                    <button
                      className="min-w-0 flex-1 text-left"
                      onClick={() => onSelect(f)}
                    >
                      <div className="text-sm font-medium">
                        <FavoriteItemDisplay item={f} lang={lang} kmbStops={kmbStops} />
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
                  Tip: results can auto-refresh while you wait.
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearRecents}
                  className="rounded-xl"
                  disabled={!recents.length}
                >
                  Clear
                </Button>
              </div>

              {recents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent searches.</div>
              ) : (
                recents.map((r) => (
                  <button
                    key={`${r.id}-${r.at}`}
                    className="w-full rounded-2xl border bg-background/40 px-3 py-2 text-left hover:bg-background/60"
                    onClick={() => onSelect(r)}
                  >
                     <div className="text-sm font-medium">
                       <FavoriteItemDisplay item={r} lang={lang} kmbStops={kmbStops} />
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
