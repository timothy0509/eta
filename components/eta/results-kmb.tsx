"use client";

import * as React from "react";
import { Clock, Info, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RouteBadge } from "@/components/eta/route-badge";
import type { UiLanguage } from "@/lib/eta/types";
import type { KmbEtaEntry } from "@/lib/eta/kmb";
import type { KmbRouteInfoLite } from "@/lib/eta/client";
import { formatRelativeMinutes } from "@/lib/eta/format";
import { parseKmbStopName } from "@/lib/eta/kmb-stop-name";
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
  if (lang === "sc") return "即将到达";
  return "即將到達";
}

function formatNoScheduledText(lang: UiLanguage) {
  if (lang === "en") return "No scheduled buses";
  if (lang === "sc") return "暂时没有预定班次";
  return "暫時沒有預定班次";
}


function formatEtaLabel(seq: number, lang: UiLanguage) {
  if (lang === "en") {
    if (seq === 1) return "1st";
    if (seq === 2) return "2nd";
    if (seq === 3) return "3rd";
    return `${seq}th`;
  }
  return `第${seq}${lang === "sc" ? "班" : "班"}`;
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
  lastUpdatedAt?: number;
  stale?: boolean;
  error?: string | null;
  onRefresh: () => void;
  loading?: boolean;
  /** For showing stop codes next to routes when multiple stops are selected */
  stops?: StopInfo[];
  /** Whether multiple stops are selected (grouped stops mode) */
  multipleStops?: boolean;
  /** Whether this is a keyphrase search (contains mode) - renders stop sections */
  isKeyphraseMode?: boolean;
  /** ETAs grouped by stop ID for sectioned rendering */
  etaByStopId?: Record<string, KmbEtaEntry[]>;
  /** Ordered list of stop IDs that have been loaded */
  loadedStopIds?: string[];
  /** Sentinel ref for infinite scroll */
  sentinelRef?: React.RefObject<HTMLDivElement | null>;
  /** Whether there are more stops to load */
  hasMoreStops?: boolean;
};

/** Group ETAs by route variant for a single stop */
function groupEtasByVariant(
  eta: KmbEtaEntry[],
  routeInfos: Record<string, KmbRouteInfoLite>,
  lang: UiLanguage
) {
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
    return { key, items: sorted, hasEta: hasValidEta(sorted) };
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
}

/** Render a single route variant card */
function RouteVariantCard({
  variantKey,
  items,
  hasEta,
  routeInfos,
  lang,
  now,
  staggerClass,
  showStopCode,
  stopCode,
}: {
  variantKey: string;
  items: KmbEtaEntry[];
  hasEta: boolean;
  routeInfos: Record<string, KmbRouteInfoLite>;
  lang: UiLanguage;
  now: Date;
  staggerClass?: string;
  showStopCode?: boolean;
  stopCode?: string | null;
}) {
  const [route] = variantKey.split("|");
  const first = items[0];
  const label = formatRouteVariantLabel(routeInfos[variantKey], first, lang);

  // Routes without valid ETAs get a simplified display
  if (!hasEta) {
    const remark = getGroupRemark(items, lang);
    return (
      <div
        className={cn(
          "ui-animate-in ui-lift rounded-2xl border bg-background/40 p-4 opacity-70",
          staggerClass
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <RouteBadge route={route} size="lg" />
            <div className="min-w-0 truncate text-sm font-medium">{label || "Route"}</div>
          </div>
          {showStopCode && stopCode ? (
            <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
              {stopCode}
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
    <div
      className={cn("ui-animate-in ui-lift rounded-2xl border bg-background/40 p-4", staggerClass)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <RouteBadge route={route} size="lg" />
          <div className="min-w-0 truncate text-sm font-medium">{label || "Route"}</div>
        </div>
        {showStopCode && stopCode ? (
          <Badge variant="outline" className="shrink-0 rounded-lg font-mono text-xs">
            {stopCode}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        {items.slice(0, 3).map((entry, entryIdx) => {
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
              key={`${variantKey}:${entry.eta_seq}:${entry.eta ?? ""}:${entry.data_timestamp ?? ""}:${entryIdx}`}
              className={cn(
                "ui-lift min-w-[150px] shrink-0 rounded-2xl border bg-card/40 p-3 sm:min-w-0",
                entry.eta_seq === 1 && "bg-card/60"
              )}
            >
              <div className="text-xs text-muted-foreground">{formatEtaLabel(entry.eta_seq, lang)}</div>
              <div className="mt-1 font-tabular text-2xl font-semibold tracking-tight">
                {minutes === null || Number.isNaN(minutes)
                  ? "—"
                  : minutes <= 0
                    ? formatArrivingText(lang)
                    : lang === "en"
                      ? `${minutes} min`
                      : `${minutes} 分`}
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
}

/** Render a stop section with its routes */
function StopSection({
  stopId,
  stopInfo,
  eta,
  routeInfos,
  lang,
  now,
  isFirst,
}: {
  stopId: string;
  stopInfo?: StopInfo;
  eta: KmbEtaEntry[];
  routeInfos: Record<string, KmbRouteInfoLite>;
  lang: UiLanguage;
  now: Date;
  isFirst?: boolean;
}) {
  const stopName = stopInfo ? pickStopName(stopInfo, lang) : `Stop ${stopId}`;
  const parsed = parseKmbStopName(stopName);
  const stopCodeBadge = parsed.platform ?? parsed.stopCode ?? null;

  const groups = groupEtasByVariant(eta, routeInfos, lang);

  return (
    <div className={cn("space-y-3", !isFirst && "mt-6 border-t pt-6")}>
      {/* Stop header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-foreground">{parsed.name}</h3>
        {stopCodeBadge ? (
          <Badge variant="secondary" className="rounded-lg font-mono text-xs">
            {stopCodeBadge}
          </Badge>
        ) : null}
      </div>

      {/* Route cards for this stop */}
      {groups.length === 0 ? (
        <div className="flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
          <Info className="h-4 w-4" />
          {formatNoScheduledText(lang)}
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g, idx) => (
            <RouteVariantCard
              key={g.key}
              variantKey={g.key}
              items={g.items}
              hasEta={g.hasEta}
              routeInfos={routeInfos}
              lang={lang}
              now={now}
              staggerClass={
                isFirst
                  ? idx === 0
                    ? "ui-stagger-1"
                    : idx === 1
                      ? "ui-stagger-2"
                      : idx === 2
                        ? "ui-stagger-3"
                        : ""
                  : ""
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function KmbResults({
  lang,
  title,
  stopCode,
  routesFilter,
  eta,
  routeInfos,
  hasQuery,
  lastUpdatedAt,
  stale,
  error,
  onRefresh,
  loading,
  stops,
  multipleStops,
  isKeyphraseMode,
  etaByStopId,
  loadedStopIds,
  sentinelRef,
  hasMoreStops,
}: Props) {
  const now = new Date();
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null;

  // Create a lookup map for stops by ID
  const stopLookup = React.useMemo(() => {
    if (!stops) return new Map<string, StopInfo>();
    return new Map(stops.map((s) => [s.stopId, s]));
  }, [stops]);

  // For keyphrase mode, use sectioned rendering
  const useStopSections = isKeyphraseMode && etaByStopId && loadedStopIds && loadedStopIds.length > 0;

  // Legacy grouped mode (flat list with stop codes per route)
  const grouped = React.useMemo(() => {
    if (useStopSections) return []; // Not used in sectioned mode

    const byVariant = new Map<string, KmbEtaEntry[]>();
    for (const entry of eta) {
      const route = (entry.route ?? "").toUpperCase();
      const dir = String(entry.dir ?? "");
      const serviceType = String(entry.service_type ?? "");
      const baseKey = `${route}|${dir}|${serviceType}`;
      const key = multipleStops ? `${baseKey}|${entry.stop ?? ""}` : baseKey;

      const items = byVariant.get(key) ?? [];
      items.push(entry);
      byVariant.set(key, items);
    }

    const groups = Array.from(byVariant.entries()).map(([key, items]) => {
      const sorted = [...items].sort((a, b) => a.eta_seq - b.eta_seq);
      const [route, dir, serviceType, keyStopId] = key.split("|");
      const baseKey = `${route}|${dir}|${serviceType}`;

      // Find the stop code for this route (from the first entry)
      const stopId = keyStopId || sorted[0]?.stop;
      const stop = stopId ? stopLookup.get(stopId) : undefined;
      const parsed = stop ? parseKmbStopName(pickStopName(stop, lang)) : null;
      const routeStopLabel = parsed?.platform ?? parsed?.stopCode ?? null;
      return { key, baseKey, items: sorted, hasEta: hasValidEta(sorted), stopCode: routeStopLabel };
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
  }, [eta, stopLookup, lang, multipleStops, useStopSections]);

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
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
             <Clock className="h-3.5 w-3.5" />
             {routesFilter?.trim()

              ? lang === "en"
                ? `Filtered: ${routesFilter}`
                 : lang === "sc"
                   ? `筛选: ${routesFilter}`
                   : `篩選: ${routesFilter}`
               : isKeyphraseMode
                 ? lang === "en"
                   ? `${loadedStopIds?.length ?? 0} stops loaded`
                   : lang === "sc"
                     ? `已载入 ${loadedStopIds?.length ?? 0} 个车站`
                     : `已載入 ${loadedStopIds?.length ?? 0} 個車站`
                 : lang === "en"
                   ? "All routes at this stop"
                   : lang === "sc"
                     ? "此站所有路线"
                     : "此站所有路線"}

            {updatedAt ? (
              <>
                <span aria-hidden>·</span>
                <span>
                  {lang === "en"
                    ? `Updated ${updatedAt.toLocaleTimeString()}`
                    : lang === "sc"
                      ? `更新 ${updatedAt.toLocaleTimeString()}`
                      : `更新 ${updatedAt.toLocaleTimeString()}`}
                </span>
              </>
            ) : null}

            {stale ? (
              <Badge variant="destructive" className="rounded-lg">
                {lang === "en" ? "Stale" : lang === "sc" ? "未更新" : "未更新"}
              </Badge>
            ) : null}
          </div>


        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 rounded-xl"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "ui-spin")} />
          {lang === "en" ? "Refresh" : lang === "sc" ? "重新整理" : "重新整理"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error ? (
          <div className="ui-animate-fade rounded-2xl border bg-destructive/10 p-4 text-sm text-destructive">
            {lang === "en"
              ? `Update failed. Showing last results. (${error})`
              : lang === "sc"
                ? `更新失败。显示上次结果。(${error})`
                : `更新失敗。顯示上次結果。(${error})`}

          </div>
        ) : null}
        {!hasQuery ? (
          <div className="ui-animate-fade flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            {lang === "en"
              ? "Select a stop to load ETAs."
              : lang === "sc"
                ? "选择车站以载入到站时间"
                : "選擇車站以載入到站時間"}
          </div>

        ) : useStopSections ? (
          // Keyphrase mode: sectioned by stop
          <>
            {loadedStopIds!.map((stopId, idx) => (
              <StopSection
                key={stopId}
                stopId={stopId}
                stopInfo={stopLookup.get(stopId)}
                eta={etaByStopId![stopId] ?? []}
                routeInfos={routeInfos}
                lang={lang}
                now={now}
                isFirst={idx === 0}
              />
            ))}

            {/* Infinite scroll sentinel */}
            {hasMoreStops ? (
              <div
                ref={sentinelRef}
                className="flex items-center justify-center py-4"
              >
                {loading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {lang === "en" ? "Loading more stops..." : lang === "sc" ? "正在载入更多车站..." : "正在載入更多車站..."}
                  </div>
                ) : (
                  <div className="h-1" /> // Invisible sentinel
                )}
              </div>
            ) : loadedStopIds!.length > 0 ? (
              <div className="text-center text-xs text-muted-foreground py-2">
                {lang === "en"
                  ? `All ${loadedStopIds!.length} stops loaded`
                  : lang === "sc"
                    ? `已载入全部 ${loadedStopIds!.length} 个车站`
                    : `已載入全部 ${loadedStopIds!.length} 個車站`}
              </div>
            ) : null}
          </>
        ) : grouped.length === 0 ? (
          <div className="ui-animate-fade flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            {formatNoScheduledText(lang)}
          </div>
        ) : (
          // Legacy flat list mode
          grouped.map((g, idx) => {
            const [route] = g.baseKey.split("|");
            const first = g.items[0];
            const label = formatRouteVariantLabel(routeInfos[g.baseKey], first, lang);
            const staggerClass =
              idx === 0
                ? "ui-stagger-1"
                : idx === 1
                  ? "ui-stagger-2"
                  : idx === 2
                    ? "ui-stagger-3"
                    : "";

            // Routes without valid ETAs get a simplified display
            if (!g.hasEta) {
              const remark = getGroupRemark(g.items, lang);
              return (
                <div
                  key={g.key}
                  className={cn(
                    "ui-animate-in ui-lift rounded-2xl border bg-background/40 p-4 opacity-70",
                    staggerClass
                  )}
                >

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
              <div
                key={g.key}
                className={cn("ui-animate-in ui-lift rounded-2xl border bg-background/40 p-4", staggerClass)}
              >
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
                  {g.items.slice(0, 3).map((entry, entryIdx) => {
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
                        key={`${g.key}:${entry.eta_seq}:${entry.eta ?? ""}:${entry.data_timestamp ?? ""}:${entryIdx}`}
                        className={cn(
                          "ui-lift min-w-[150px] shrink-0 rounded-2xl border bg-card/40 p-3 sm:min-w-0",
                          entry.eta_seq === 1 && "bg-card/60"
                        )}
                      >
                        <div className="text-xs text-muted-foreground">{formatEtaLabel(entry.eta_seq, lang)}</div>
                        <div className="mt-1 font-tabular text-2xl font-semibold tracking-tight">
                          {minutes === null || Number.isNaN(minutes)
                            ? "—"
                            : minutes <= 0
                              ? formatArrivingText(lang)
                              : lang === "en"
                                ? `${minutes} min`
                                : `${minutes} 分`}
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
