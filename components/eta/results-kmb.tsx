"use client";

import * as React from "react";
import { Clock, Info, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteBadge } from "@/components/eta/route-badge";
import type { UiLanguage } from "@/lib/eta/types";
import type { KmbEtaEntry } from "@/lib/eta/kmb";
import type { KmbRouteInfoLite } from "@/lib/eta/client";
import { formatRelativeMinutes } from "@/lib/eta/format";
import { cn } from "@/lib/utils";

function pickLang(fields: { en: string; tc: string; sc: string }, lang: UiLanguage) {
  if (lang === "sc") return fields.sc;
  if (lang === "en") return fields.en;
  return fields.tc;
}

function formatRouteVariantLabel(
  info: KmbRouteInfoLite | undefined,
  etaFallback: KmbEtaEntry | undefined,
  lang: UiLanguage
) {
  if (info) {
    const destination = pickLang(info.destination, lang);
    if (destination) return `→ ${destination}`;
  }

  if (!etaFallback) return "";

  const dest = pickLang(
    {
      en: etaFallback.dest_en ?? "",
      tc: etaFallback.dest_tc ?? "",
      sc: etaFallback.dest_sc ?? "",
    },
    lang
  );
  return dest ? `→ ${dest}` : "";
}

function formatArrivingText(lang: UiLanguage) {
  if (lang === "en") return "Now";
  return "即將到達";
}

function formatNoScheduledText(lang: UiLanguage) {
  if (lang === "en") return "No scheduled buses";
  return "暫時沒有預定班次";
}

function formatEtaLabel(seq: number, lang: UiLanguage) {
  if (lang === "en") {
    if (seq === 1) return "1st";
    if (seq === 2) return "2nd";
    if (seq === 3) return "3rd";
    return `${seq}th`;
  }
  return `第${seq}班`;
}

function hasValidEta(items: KmbEtaEntry[]): boolean {
  return items.some((entry) => entry.eta && !isNaN(Date.parse(entry.eta)));
}

function getGroupRemark(items: KmbEtaEntry[], lang: UiLanguage): string | null {
  for (const entry of items) {
    const remark = pickLang(
      { en: entry.rmk_en ?? "", tc: entry.rmk_tc ?? "", sc: entry.rmk_sc ?? "" },
      lang
    );
    if (remark?.trim()) return remark.trim();
  }
  return null;
}

/**
 * Parse a KMB stop name to extract the code from parentheses.
 * e.g., "Chuk Yuen Estate Bus Terminus (WT916)" → { name: "Chuk Yuen Estate Bus Terminus", code: "WT916" }
 */
function parseStopCode(fullName: string): string | null {
  const match = fullName.match(/\(([A-Z]{1,2}\d+)\)\s*$/);
  return match ? match[1] : null;
}

function pickStopName(
  stop: { nameEn: string; nameTc: string; nameSc: string } | undefined,
  lang: UiLanguage
): string {
  if (!stop) return "";
  if (lang === "sc") return stop.nameSc;
  if (lang === "en") return stop.nameEn;
  return stop.nameTc;
}

type StopInfo = {
  stopId: string;
  nameEn: string;
  nameTc: string;
  nameSc: string;
};

type Props = {
  lang: UiLanguage;
  title?: string;
  stopCode?: string | null;
  routesFilter?: string;
  eta: KmbEtaEntry[];
  routeInfos: Record<string, KmbRouteInfoLite>;
  hasQuery: boolean;
  onRefresh: () => void;
  loading?: boolean;
  /** For showing stop codes next to routes when multiple stops are selected */
  stops?: StopInfo[];
  /** Whether multiple stops are selected (grouped stops mode) */
  multipleStops?: boolean;
};

export function KmbResults({
  lang,
  title,
  stopCode,
  routesFilter,
  eta,
  routeInfos,
  hasQuery,
  onRefresh,
  loading,
  stops,
  multipleStops,
}: Props) {
  const now = new Date();

  // Create a lookup map for stops by ID
  const stopLookup = React.useMemo(() => {
    if (!stops) return new Map<string, StopInfo>();
    return new Map(stops.map((s) => [s.stopId, s]));
  }, [stops]);

  const grouped = React.useMemo(() => {
    const byVariant = new Map<string, KmbEtaEntry[]>();
    for (const entry of eta) {
      const route = (entry.route ?? "").toUpperCase();
      const dir = String(entry.dir ?? "");
      const serviceType = String(entry.service_type ?? "");
      const key = `${route}|${dir}|${serviceType}`;

      const items = byVariant.get(key) ?? [];
      items.push(entry);
      byVariant.set(key, items);
    }

    const groups = Array.from(byVariant.entries()).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.eta_seq - b.eta_seq);
      // Find the stop code for this route (from the first entry)
      const stopId = sorted[0]?.stop;
      const stop = stopId ? stopLookup.get(stopId) : undefined;
      const routeStopCode = stop ? parseStopCode(pickStopName(stop, lang)) : null;
      return { key, items: sorted, hasEta: hasValidEta(sorted), stopCode: routeStopCode };
    });

    // Sort alphabetically by route number
    const sortByRoute = (a: { key: string }, b: { key: string }) => {
      const [routeA] = a.key.split("|");
      const [routeB] = b.key.split("|");
      return routeA.localeCompare(routeB, undefined, { numeric: true });
    };

    // Routes with ETAs first, then routes without ETAs
    const withEtas = groups.filter((g) => g.hasEta).sort(sortByRoute);
    const withoutEtas = groups.filter((g) => !g.hasEta).sort(sortByRoute);

    return [...withEtas, ...withoutEtas];
  }, [eta, stopLookup, lang]);

  return (
    <Card className="rounded-3xl border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <CardTitle className="truncate text-base">{title || "KMB ETAs"}</CardTitle>
            {stopCode ? (
              <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
                {stopCode}
              </Badge>
            ) : null}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {routesFilter?.trim()
              ? (lang === "en" ? `Filtered: ${routesFilter}` : `篩選: ${routesFilter}`)
              : (lang === "en" ? "All routes at this stop" : "此站所有路線")}
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-xl"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          {lang === "en" ? "Refresh" : "重新整理"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {!hasQuery ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            {lang === "en" ? "Select a stop to load ETAs." : "選擇車站以載入到站時間"}
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            {formatNoScheduledText(lang)}
          </div>
        ) : (
          grouped.map((g) => {
            const [route] = g.key.split("|");
            const first = g.items[0];
            const label = formatRouteVariantLabel(routeInfos[g.key], first, lang);

            // Routes without valid ETAs get a simplified display
            if (!g.hasEta) {
              const remark = getGroupRemark(g.items, lang);
              return (
                <div key={g.key} className="rounded-2xl border bg-background/40 p-4 opacity-70">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <RouteBadge route={route} size="lg" />
                      <div className="min-w-0 truncate text-sm font-medium">{label || "Route"}</div>
                    </div>
                    {multipleStops && g.stopCode ? (
                      <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
                        {g.stopCode}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4 shrink-0" />
                    {remark || formatNoScheduledText(lang)}
                  </div>
                </div>
              );
            }

            return (
              <div key={g.key} className="rounded-2xl border bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <RouteBadge route={route} size="lg" />
                    <div className="min-w-0 truncate text-sm font-medium">{label || "Route"}</div>
                  </div>
                  {multipleStops && g.stopCode ? (
                    <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
                      {g.stopCode}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
                  {g.items.slice(0, 3).map((entry) => {
                    const minutes = entry.eta ? formatRelativeMinutes(entry.eta, now) : null;
                    const remark = pickLang(
                      {
                        en: entry.rmk_en ?? "",
                        tc: entry.rmk_tc ?? "",
                        sc: entry.rmk_sc ?? "",
                      },
                      lang
                    );
                    return (
                      <div
                        key={`${g.key}:${entry.eta_seq}`}
                        className={cn(
                          "min-w-[150px] shrink-0 rounded-2xl border bg-card/40 p-3 sm:min-w-0",
                          entry.eta_seq === 1 && "bg-card/60"
                        )}
                      >
                        <div className="text-xs text-muted-foreground">{formatEtaLabel(entry.eta_seq, lang)}</div>
                        <div className="mt-1 font-tabular text-2xl font-semibold tracking-tight">
                          {minutes === null || Number.isNaN(minutes)
                            ? "—"
                            : minutes <= 0
                              ? formatArrivingText(lang)
                              : `${minutes} min`}
                        </div>
                        {remark ? (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {remark}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
