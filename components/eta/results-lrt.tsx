"use client";

import { Info, RefreshCw, TramFront } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { LrtScheduleResponse } from "@/lib/eta/lrt";
import type { UiLanguage } from "@/lib/eta/types";

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
            Light Rail
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
            Select a stop to view trains.
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>System time</span>
              <span>{schedule.system_time ?? ""}</span>
            </div>
            <div className="space-y-3">
              {(schedule.platform_list ?? []).map((p) => (
                <div
                  key={p.platform_id}
                  className="rounded-2xl border bg-background/40 p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">Platform {p.platform_id}</div>
                    <Badge variant="secondary" className="rounded-xl">
                      {(p.route_list ?? []).length} routes
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
                    {(p.route_list ?? []).map((r, idx) => (
                      <div
                        key={`${p.platform_id}-${r.route_no}-${idx}`}
                        className="flex items-start justify-between gap-3 rounded-2xl border bg-card/30 p-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge className="rounded-xl" variant="outline">
                              {r.route_no}
                            </Badge>
                            <div className="truncate text-sm font-medium">
                              {lang === "en" ? r.dest_en : r.dest_ch}
                            </div>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {r.arrival_departure === "A" ? "Arrive" : "Depart"} · Train {r.train_length}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold">
                            {lang === "en" ? r.time_en : r.time_ch}
                          </div>
                          {r.stop ? (
                            <div className="text-xs text-destructive">Stopped</div>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
