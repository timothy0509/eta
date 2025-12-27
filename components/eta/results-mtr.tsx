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
  onRefresh: () => void;
  loading?: boolean;
};

// EAL station order (from south to north, excluding branch terminals)
// Used to determine if "via Racecourse" is relevant for the current station
const EAL_STATION_ORDER = [
  "ADM", // Admiralty
  "EXC", // Exhibition Centre
  "HUH", // Hung Hom
  "MKK", // Mong Kok East
  "KOT", // Kowloon Tong
  "TAW", // Tai Wai
  "SHT", // Sha Tin
  "FOT", // Fo Tan
  "RAC", // Racecourse
  "UNI", // University
  "TAP", // Tai Po Market
  "TWO", // Tai Wo
  "FAN", // Fanling
  "SHS", // Sheung Shui
  "LOW", // Lo Wu (branch)
  "LMC", // Lok Ma Chau (branch)
];

function getEalStationIndex(sta: string): number {
  return EAL_STATION_ORDER.indexOf(sta);
}

/**
 * Determine if we should show "via Racecourse" for a train.
 * Only show when:
 * 1. The train's route is "RAC"
 * 2. The current station is BEFORE Racecourse in the line order
 * 3. The train's destination is AFTER Racecourse (train hasn't passed it yet)
 */
function shouldShowViaRacecourse(
  line: string,
  currentSta: string,
  destSta: string,
  route: string | undefined
): boolean {
  if (line !== "EAL") return false;
  if (route !== "RAC") return false;

  const racecourseIdx = getEalStationIndex("RAC");
  const currentIdx = getEalStationIndex(currentSta);
  const destIdx = getEalStationIndex(destSta);

  // If we can't find the station in our order, don't show
  if (currentIdx === -1 || destIdx === -1 || racecourseIdx === -1) return false;

  // Current station must be before Racecourse, and destination must be after Racecourse
  // This means the train will pass through Racecourse on its way
  return currentIdx < racecourseIdx && destIdx > racecourseIdx;
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
  return lang === "en" ? `${minutes} min` : `${minutes} 分`;
}

function formatPlatform(plat: unknown) {
  const raw = String(plat ?? "").trim();
  if (!raw) return "";
  return raw;
}

export function MtrResults({ title, lang, schedule, onRefresh, loading }: Props) {
  return (
    <Card className="rounded-3xl border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <TrainFront className="h-3.5 w-3.5" />
            Next Train
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
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!schedule ? (
          <div className="ui-animate-fade flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            Select a station to view trains.
          </div>
        ) : schedule.status === 0 ? (
          <div className="ui-animate-in rounded-2xl border bg-background/50 p-4">
            <div className="text-sm font-medium">Service message</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {schedule.message ?? "No schedule available."}
            </div>
            {schedule.url ? (
              <a
                className="ui-lift mt-3 inline-flex items-center gap-2 rounded-xl border bg-card/50 px-3 py-2 text-sm hover:bg-card"
                href={schedule.url}
                target="_blank"
                rel="noreferrer"
              >
                View details <ExternalLink className="h-4 w-4" />
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
                        {dir}
                      </div>
                      <div className="mt-2 space-y-2">
                        {trains.length === 0 ? (
                          <div className="text-sm text-muted-foreground">—</div>
                        ) : (
                          trains.slice(0, 4).map((t, idx) => {
                            const destSta = String(t.dest ?? "");
                            const route = String((t as { route?: unknown }).route ?? "");
                            const showViaRacecourse = shouldShowViaRacecourse(
                              line,
                              sta,
                              destSta,
                              route || undefined
                            );
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
