"use client";

import { ExternalLink, Info, RefreshCw, TrainFront } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

function formatDest(dest: unknown, lang: UiLanguage) {
  const raw = String(dest ?? "");
  if (!raw) return "";
  const station = findMtrStationBySta(raw);
  if (!station) return raw;
  return lang === "en" ? station.nameEn : station.nameTc;
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
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!schedule ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            Select a station to view trains.
          </div>
        ) : schedule.status === 0 ? (
          <div className="rounded-2xl border bg-background/50 p-4">
            <div className="text-sm font-medium">Service message</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {schedule.message ?? "No schedule available."}
            </div>
            {schedule.url ? (
              <a
                className="mt-3 inline-flex items-center gap-2 rounded-xl border bg-card/50 px-3 py-2 text-sm hover:bg-card"
                href={schedule.url}
                target="_blank"
                rel="noreferrer"
              >
                View details <ExternalLink className="h-4 w-4" />
              </a>
            ) : null}
          </div>
        ) : (
          Object.entries(schedule.data ?? {}).map(([key, payload]) => {
            const [line, sta] = key.split("-");
            const station = sta ? findMtrStationBySta(sta) : undefined;
            const stationName = station ? (lang === "en" ? station.nameEn : station.nameTc) : sta;

            return (
              <div key={key} className="rounded-2xl border bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {line ? (
                      <Badge className="rounded-xl text-white" style={{ backgroundColor: getLineColor(line) }}>
                        {line}
                      </Badge>
                    ) : null}
                    <div className="min-w-0 truncate text-sm font-medium">
                      {stationName ? `${stationName}${sta ? ` (${sta})` : ""}` : key}
                    </div>
                  </div>
                  <Badge variant="secondary" className="rounded-xl">
                    Updated
                  </Badge>
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
                          trains.slice(0, 4).map((t, idx) => (
                            <div
                              key={`${dir}-${idx}`}
                              className="flex items-center justify-between gap-3 rounded-xl border bg-background/30 px-3 py-2"
                            >
                               <div className="min-w-0">
                                 <div className="truncate text-sm font-medium">
                                   {formatDest(t.dest, lang)}
                                 </div>
                               </div>
                                <div className="flex items-center gap-2">
                                  {formatPlatform(t.plat) ? (
                                    <Badge className="rounded-xl" variant="secondary">
                                      {lang === "en" ? `Plat ${formatPlatform(t.plat)}` : `月台 ${formatPlatform(t.plat)}`}
                                    </Badge>
                                  ) : null}
                                  {line === "EAL" && String((t as { route?: unknown }).route ?? "") === "RAC" ? (
                                    <Badge className="rounded-xl" variant="secondary">
                                      {lang === "en" ? "Via Racecourse" : "經馬場"}
                                    </Badge>
                                  ) : null}
                                  <Badge className="rounded-xl" variant="outline">
                                    {formatMinutes(t.ttnt, lang)}
                                  </Badge>
                                </div>
                            </div>
                          ))
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
