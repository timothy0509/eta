"use client";

import { MapPin, MapPinOff } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNearbyStops, type GeoPoint, type NearbyStop } from "@/lib/eta/nearby";
import { parseKmbStopName } from "@/lib/eta/kmb-stop-name";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";

type Props = {
  lang: UiLanguage;
  stops: KmbStopSearchItem[];
  loadingStops?: boolean;
  selectedStopId?: string | null;
  onSelectStop: (stop: KmbStopSearchItem) => void;
};

type LocationState =
  | { status: "idle"; location: null; error: null }
  | { status: "loading"; location: null; error: null }
  | { status: "ready"; location: GeoPoint; error: null }
  | { status: "denied"; location: null; error: string }
  | { status: "error"; location: null; error: string };

const MAX_NEARBY_DISTANCE_METERS = 1500;
const NEARBY_LIMIT = 8;

function formatDistance(distanceMeters: number, lang: UiLanguage) {
  if (distanceMeters < 1000) {
    const meters = Math.round(distanceMeters / 10) * 10;
    return lang === "en" ? `${meters} m` : `${meters} 米`;
  }
  const km = (distanceMeters / 1000).toFixed(1);
  return lang === "en" ? `${km} km` : `${km} 公里`;
}

function formatStopName(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "en") return stop.nameEn;
  if (lang === "sc") return stop.nameSc;
  return stop.nameTc;
}

function formatSecondary(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "en") return stop.nameTc;
  return stop.nameEn;
}

export function NearbyStops({
  lang,
  stops,
  loadingStops,
  selectedStopId,
  onSelectStop,
}: Props) {
  const [locationState, setLocationState] = React.useState<LocationState>({
    status: "idle",
    location: null,
    error: null,
  });

  const nearbyStops = React.useMemo(() => {
    if (locationState.status !== "ready") return [] as NearbyStop[];
    return getNearbyStops(stops, locationState.location, {
      limit: NEARBY_LIMIT,
      maxDistanceMeters: MAX_NEARBY_DISTANCE_METERS,
    });
  }, [stops, locationState]);

  const requestLocation = React.useCallback(() => {
    if (!("geolocation" in navigator)) {
      setLocationState({
        status: "error",
        location: null,
        error: lang === "en" ? "Geolocation not supported" : lang === "sc" ? "不支援定位" : "不支援定位",
      });
      return;
    }

    setLocationState({ status: "loading", location: null, error: null });

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationState({
          status: "ready",
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          error: null,
        });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setLocationState({
            status: "denied",
            location: null,
            error:
              lang === "en"
                ? "Location permission denied"
                : lang === "sc"
                  ? "定位权限被拒绝"
                  : "定位權限被拒絕",
          });
          return;
        }

        setLocationState({
          status: "error",
          location: null,
          error:
            lang === "en"
              ? "Unable to get your location"
              : lang === "sc"
                ? "无法取得定位"
                : "無法取得定位",
        });
      },
      {
        enableHighAccuracy: true,
        maximumAge: 30000,
        timeout: 10000,
      },
    );
  }, [lang]);

  const i18n = {
    title: lang === "en" ? "Nearby stops" : lang === "sc" ? "附近车站" : "附近車站",
    subtitle: lang === "en" ? "Use your location" : lang === "sc" ? "使用定位" : "使用定位",
    button: lang === "en" ? "Find nearby" : lang === "sc" ? "寻找附近" : "尋找附近",
    loading: lang === "en" ? "Locating…" : lang === "sc" ? "定位中…" : "定位中…",
    empty: lang === "en" ? "No nearby stops" : lang === "sc" ? "附近没有车站" : "附近沒有車站",
  };

  return (
    <div className="rounded-2xl border bg-background/40 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{i18n.title}</div>
          <div className="text-xs text-muted-foreground">{i18n.subtitle}</div>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl"
          onClick={requestLocation}
          disabled={locationState.status === "loading" || loadingStops}
        >
          {locationState.status === "loading" ? (
            <>
              <MapPin className="mr-2 h-4 w-4 animate-pulse" />
              {i18n.loading}
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              {i18n.button}
            </>
          )}
        </Button>
      </div>

      {locationState.status === "denied" || locationState.status === "error" ? (
        <div className="mt-3 flex items-center gap-2 text-xs text-destructive">
          <MapPinOff className="h-4 w-4" />
          <span>{locationState.error}</span>
        </div>
      ) : null}

      {locationState.status === "ready" ? (
        <div className="mt-3 space-y-2">
          {nearbyStops.length === 0 ? (
            <div className="text-xs text-muted-foreground">{i18n.empty}</div>
          ) : (
            nearbyStops.map((entry) => {
              const fullName = formatStopName(entry.stop, lang);
              const parsed = parseKmbStopName(fullName);
              const secondary = formatSecondary(entry.stop, lang);
              const isSelected = selectedStopId === entry.stop.stopId;
              const badge = parsed.platform ?? parsed.stopCode;
              return (
                <button
                  key={entry.stop.stopId}
                  type="button"
                  className={cn(
                    "ui-animate-in ui-lift w-full rounded-2xl border bg-card/70 px-3 py-2 text-left transition",
                    "hover:bg-card",
                    isSelected && "border-primary/40 bg-primary/10",
                  )}
                  onClick={() => onSelectStop(entry.stop)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">
                        {parsed.name}
                        {badge ? (
                          <span className="ml-2 font-mono text-xs text-muted-foreground">
                            {badge}
                          </span>
                        ) : null}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{secondary}</div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">
                      {formatDistance(entry.distanceMeters, lang)}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
