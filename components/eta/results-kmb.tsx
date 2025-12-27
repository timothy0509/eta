"use client";

import * as React from "react";
import { Clock, Info, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { UiLanguage } from "@/lib/eta/types";
import type { KmbEtaEntry } from "@/lib/eta/kmb";
import type { KmbRouteInfoLite } from "@/lib/eta/client";
import { formatRelativeMinutes } from "@/lib/eta/format";

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
    const origin = pickLang(info.origin, lang);
    const destination = pickLang(info.destination, lang);
    if (origin && destination) return `${origin} → ${destination}`;
  }

  if (!etaFallback) return "";

  return (
    pickLang(
      {
        en: etaFallback.dest_en ?? "",
        tc: etaFallback.dest_tc ?? "",
        sc: etaFallback.dest_sc ?? "",
      },
      lang
    ) || ""
  );
}

type Props = {
  lang: UiLanguage;
  title?: string;
  routesFilter?: string;
  eta: KmbEtaEntry[];
  routeInfos: Record<string, KmbRouteInfoLite>;
  hasQuery: boolean;
  onRefresh: () => void;
  loading?: boolean;
};

export function KmbResults({
  lang,
  title,
  routesFilter,
  eta,
  routeInfos,
  hasQuery,
  onRefresh,
  loading,
}: Props) {
  const now = new Date();

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

    return Array.from(byVariant.entries())
      .map(([key, items]) => {
        const sorted = [...items].sort((a, b) => a.eta_seq - b.eta_seq);
        return { key, items: sorted };
      })
      .sort((a, b) => {
        const [routeA] = a.key.split("|");
        const [routeB] = b.key.split("|");
        return routeA.localeCompare(routeB, undefined, { numeric: true });
      });
  }, [eta]);

  return (
    <Card className="rounded-3xl border bg-card/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between gap-6">
        <div>
          <CardTitle className="text-base">{title || "KMB ETAs"}</CardTitle>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {routesFilter?.trim() ? `Filtered: ${routesFilter}` : "All routes at this stop"}
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
      <CardContent className="space-y-5">
        {!hasQuery ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            Search to load ETAs.
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-background/40 p-4 text-sm text-muted-foreground">
            <Info className="h-4 w-4" />
            No ETA data available.
          </div>
        ) : (
          grouped.map((g) => {
            const [route] = g.key.split("|");
            const first = g.items[0];
            const label = formatRouteVariantLabel(routeInfos[g.key], first, lang);

            return (
              <div key={g.key} className="rounded-2xl border bg-background/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="rounded-xl">
                      {route}
                    </Badge>
                    <div className="text-sm font-medium">{label || "Route"}</div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
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

                        className="rounded-2xl border bg-card/40 p-3"
                      >
                        <div className="text-xs text-muted-foreground">Next {entry.eta_seq}</div>
                        <div className="mt-1 text-2xl font-semibold tracking-tight">
                          {minutes === null || Number.isNaN(minutes)
                            ? "—"
                            : minutes <= 0
                              ? "Arriving"
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
