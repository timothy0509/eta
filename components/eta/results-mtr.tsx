"use client";

import { ExternalLink, Info, RefreshCw, TrainFront } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MtrScheduleResponse } from "@/lib/eta/mtr";

type Props = {
  title: string;
  schedule: MtrScheduleResponse | null;
  onRefresh: () => void;
  loading?: boolean;
};

export function MtrResults({ title, schedule, onRefresh, loading }: Props) {
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
          Object.entries(schedule.data ?? {}).map(([key, payload]) => (
            <div key={key} className="rounded-2xl border bg-background/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm font-medium">{key}</div>
                <Badge variant="secondary" className="rounded-xl">
                  Updated {schedule.curr_time ?? schedule.sys_time ?? ""}
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
                                  {String(t.dest ?? "")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {String(t.time ?? "")}
                                </div>
                              </div>
                              <Badge className="rounded-xl" variant="outline">
                                {String(t.ttnt ?? "")}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
