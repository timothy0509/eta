"use client";

import { ExternalLink, Info, RefreshCw, TrainFront } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee";
import type { MtrScheduleResponse } from "@/lib/eta/mtr";
import type { UiLanguage } from "@/lib/eta/types";
import { getLineColor } from "@/lib/eta/line-colors";
import { findMtrStationBySta } from "@/lib/data/mtr-stations";

type Props = {
  title: string;
  lang: UiLanguage;
  schedule: MtrScheduleResponse | null;
  error?: string | null;
  stale?: boolean;
  lastUpdatedAt?: number | null;
  onRefresh: () => void;
  loading?: boolean;
};

type MtrDirection = "UP" | "DOWN";

// Stations where “via Racecourse” is relevant, by direction.
// These rules are intentionally explicit (do not infer via station ordering).
const EAL_VIA_RACECOURSE_BY_DIR: Record<MtrDirection, ReadonlySet<string>> = {
  UP: new Set([
    "ADM",
    "EXC",
    "HUH",
    "MKK",
    "KOT",
    "TAW",
    "SHT",
  ]),
  DOWN: new Set([
    "LMC",
    "LOW",
    "SHS",
    "FAN",
    "TWO",
    "TAP",
    "UNI",
  ]),
};

/**
 * Determine if we should show “via Racecourse” for a train.
 * Only show when:
 * 1. Line is EAL
 * 2. Train's route is "RAC"
 * 3. The current station/direction pair makes it relevant
 *
 * Never show at Fo Tan (FOT) or Racecourse (RAC).
 */
function shouldShowViaRacecourse(params: {
  line: string;
  currentSta: string;
  dir: MtrDirection;
  route: string | undefined;
}): boolean {
  if (params.line !== "EAL") return false;
  if (params.route !== "RAC") return false;

  // Explicit exceptions
  if (params.currentSta === "FOT" || params.currentSta === "RAC") return false;

  return EAL_VIA_RACECOURSE_BY_DIR[params.dir].has(params.currentSta);
}


function formatDest(dest: unknown, lang: UiLanguage) {
  const raw = String(dest ?? "");
  if (!raw) return "";
  const station = findMtrStationBySta(raw);
  if (!station) return raw;
  return lang === "en" ? station.nameEn : station.nameTc;
}

function formatDestWithRacecourse(
  dest: unknown,
  lang: UiLanguage,
  showViaRacecourse: boolean
) {
  const destName = formatDest(dest, lang);
  if (!showViaRacecourse) return destName;

  const suffix = lang === "en" ? " · Via Racecourse" : " · 經馬場";
  return `${destName}${suffix}`;
}

function formatMinutes(ttnt: unknown, lang: UiLanguage) {
  const raw = String(ttnt ?? "").trim();
  if (!raw) return "—";
  const minutes = Number(raw);
  if (Number.isNaN(minutes)) return raw;
  if (minutes <= 0) return lang === "en" ? "Arriving" : "即將到達";
  return lang === "en"
    ? `${minutes} min`
    : lang === "sc"
      ? `${minutes} 分`
      : `${minutes} 分`;
}


function formatPlatform(plat: unknown) {
  const raw = String(plat ?? "").trim();
  if (!raw) return "";
  return raw;
}

export function MtrResults({ title, lang, schedule, error, stale, lastUpdatedAt, onRefresh, loading }: Props) {
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null;

  const t = {
    nextTrain: lang === "en" ? "Next Train" : lang === "sc" ? "下班车" : "下班車",
    refresh: lang === "en" ? "Refresh" : "重新整理",
    selectStation: lang === "en" ? "Select a station to view trains." : "選擇車站以查看班次",
    serviceMessage: lang === "en" ? "Service message" : lang === "sc" ? "服务信息" : "服務信息",
    noSchedule: lang === "en" ? "No schedule available." : lang === "sc" ? "暂无班次信息。" : "暫無班次信息。",
    viewDetails: lang === "en" ? "View details" : lang === "sc" ? "查看详情" : "查看詳情",
    up: lang === "en" ? "UP" : lang === "sc" ? "上行" : "上行",
    down: lang === "en" ? "DOWN" : lang === "sc" ? "下行" : "下行",
  };

  return (
    <Card className="rounded-3xl border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <TrainFront className="h-3.5 w-3.5" />
            {t.nextTrain}
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
          className="rounded-xl"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "ui-spin")} />
          {t.refresh}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="ui-animate-fade rounded-2xl border bg-destructive/10 p-4 text-sm text-destructive">
            {lang === "en"
              ? `Update failed. Showing last results. (${error})`
              : lang === "sc"
                ? `更新失败。显示上次结果。(${error})`
                : `更新失敗。顯示上次結果。(${error})`}
          </div>
        ) : null}
        {!schedule ? (
          <div className="ui-animate-fade flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            {t.selectStation}
          </div>
        ) : schedule.status === 0 ? (
          <div className="ui-animate-in rounded-2xl border bg-background/50 p-4">
            <div className="text-sm font-medium">{t.serviceMessage}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {schedule.message ?? t.noSchedule}
            </div>
            {schedule.url ? (
              <a
                className="ui-lift mt-3 inline-flex items-center gap-2 rounded-xl border bg-card/50 px-3 py-2 text-sm hover:bg-card"
                href={schedule.url}
                target="_blank"
                rel="noreferrer"
              >
                {t.viewDetails} <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        ) : (
          Object.entries(schedule.data ?? {}).map(([key, payload], idx) => {
            const [line, sta] = key.split("-");
            const station = sta ? findMtrStationBySta(sta) : undefined;
            const stationName = station ? (lang === "en" ? station.nameEn : station.nameTc) : sta;

            const staggerClass =
              idx === 0
                ? "ui-stagger-1"
                : idx === 1
                  ? "ui-stagger-2"
                  : idx === 2
                    ? "ui-stagger-3"
                    : "";

            return (
              <div
                key={key}
                className={cn("ui-animate-in ui-lift rounded-2xl border bg-background/40 p-4", staggerClass)}
              >
                  <div className="flex min-w-0 items-center gap-2">
                    {line ? (
                      <Badge className="rounded-xl text-white" style={{ backgroundColor: getLineColor(line) }}>
                        {line}
                      </Badge>
                    ) : null}
                    <div className="min-w-0 truncate text-sm font-medium">
                      {stationName ?? key}
                    </div>
                  </div>


                <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {(["UP", "DOWN"] as const).map((dir) => {
                    const trains = payload[dir] ?? [];
                    return (
                      <div key={dir} className="rounded-2xl border bg-card/30 p-3">
                      <div className="text-xs font-medium text-muted-foreground">
                        {dir === "UP" ? t.up : t.down}
                      </div>

                      <div className="mt-2 space-y-2">
                        {trains.length === 0 ? (
                          <div className="text-sm text-muted-foreground">—</div>
                        ) : (
                          trains.slice(0, 4).map((t, idx) => {
                            const route = String((t as { route?: unknown }).route ?? "");
                            const showViaRacecourse = shouldShowViaRacecourse({
                              line,
                              currentSta: sta,
                              dir,
                              route: route || undefined,
                            });
                            const destText = formatDestWithRacecourse(t.dest, lang, showViaRacecourse);
                            const platform = formatPlatform(t.plat);

                            return (
                              <div
                                 key={`${dir}-${idx}`}
                                 className="ui-lift flex items-center justify-between gap-3 rounded-xl border bg-background/30 px-3 py-2"
                               >

                                <Marquee className="min-w-0 flex-1 text-sm font-medium">
                                  {destText}
                                </Marquee>
                                <div className="flex shrink-0 items-center gap-2">
                                  {platform ? (
                                    <Badge
                                      className="rounded-lg px-2 py-0.5 text-xs text-white"
                                      style={{ backgroundColor: getLineColor(line) }}
                                    >
                                      {platform}
                                    </Badge>
                                  ) : null}
                                  <Badge className="font-tabular rounded-xl" variant="outline">
                                    {formatMinutes(t.ttnt, lang)}
                                  </Badge>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
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
