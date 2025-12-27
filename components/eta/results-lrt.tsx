"use client";

import { Info, RefreshCw, TramFront } from "lucide-react";

import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Marquee } from "@/components/ui/marquee";
import type { LrtScheduleResponse } from "@/lib/eta/lrt";
import type { UiLanguage } from "@/lib/eta/types";
import { getLineColor } from "@/lib/eta/line-colors";

function formatTrainLength(length: number, lang: UiLanguage) {
  if (lang === "en") return `${length}-car`;
  return `${length}卡`;
}

function formatArrivalDeparture(code: string, lang: UiLanguage) {
  if (lang === "en") return code === "A" ? "Arriving" : "Departing";
  return code === "A" ? "到達" : "離開";
}

type Props = {
  title: string;
  lang: UiLanguage;
  schedule: LrtScheduleResponse | null;
  onRefresh: () => void;
  loading?: boolean;
};

export function LrtResults({ title, lang, schedule, onRefresh, loading }: Props) {
  return (
    <Card className="rounded-3xl border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <TramFront className="h-3.5 w-3.5" />
            {lang === "en" ? "Light Rail" : "輕鐵"}
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
          {lang === "en" ? "Refresh" : "重新整理"}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {!schedule ? (
          <div className="ui-animate-fade flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            {lang === "en" ? "Select a station to view trains." : "選擇車站以查看班次"}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>System time</span>
              <span>{schedule.system_time ?? ""}</span>
            </div>
            <div className="space-y-3">
              {(schedule.platform_list ?? []).map((p, idx) => {
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
                    key={p.platform_id}
                    className={cn(
                      "ui-animate-in ui-lift rounded-2xl border bg-background/40 p-4",
                      staggerClass
                    )}
                  >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">
                      {lang === "en" ? `Platform ${p.platform_id}` : `${p.platform_id}號月台`}
                    </div>
                    <Badge variant="secondary" className="rounded-xl">
                      {(p.route_list ?? []).length} {lang === "en" ? "routes" : "條路線"}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {(p.route_list ?? []).map((r, idx) => (
                      <div
                        key={`${p.platform_id}-${r.route_no}-${idx}`}
                        className="ui-lift flex items-start justify-between gap-3 rounded-2xl border bg-card/30 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge
                              className="shrink-0 rounded-xl text-white"
                              style={{ backgroundColor: getLineColor(String(r.route_no ?? "")) }}
                            >
                              {r.route_no}
                            </Badge>
                            <Marquee className="text-sm font-medium">
                              {lang === "en" ? r.dest_en : r.dest_ch}
                            </Marquee>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {formatArrivalDeparture(r.arrival_departure, lang)} · {formatTrainLength(r.train_length, lang)}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="font-tabular text-lg font-semibold">
                            {lang === "en" ? r.time_en : r.time_ch}
                          </div>
                          {r.stop ? (
                            <div className="text-xs text-destructive">
                              {lang === "en" ? "Stopped" : "暫停服務"}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
