"use client";

import { MapPin } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { useGeolocation } from "@/lib/eta/use-geolocation";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { findNearbyStopIds } from "@/lib/eta/nearby-stops";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NearbyStopsButtonProps = {
  lang: UiLanguage;
  stops: KmbStopSearchItem[];
  disabled?: boolean;
  onNearbyStops: (stopIds: string[]) => void;
};

export function NearbyStopsButton({
  lang,
  stops,
  disabled,
  onNearbyStops,
}: NearbyStopsButtonProps) {
  const { loading, error, requestLocation } = useGeolocation();

  React.useEffect(() => {
    if (error) {
      toast.error(
        lang === "en"
          ? error
          : lang === "sc"
            ? `定位失败: ${error}`
            : `定位失敗: ${error}`,
      );
    }
  }, [error, lang]);

  const handleClick = React.useCallback(async () => {
    if (stops.length === 0) {
      toast.error(
        lang === "en"
          ? "Stop data not loaded yet"
          : lang === "sc"
            ? "车站数据未加载"
            : "車站數據未載入",
      );
      return;
    }

    const loc = await requestLocation();

    if (!loc) {
      return;
    }

    const nearbyStopIds = findNearbyStopIds(
      stops,
      { lat: loc.lat, lng: loc.lng },
      lang,
      {
        maxDistanceMeters: 300,
        maxGroups: 5,
      },
    );

    if (nearbyStopIds.length === 0) {
      toast.info(
        lang === "en"
          ? "No nearby stops found within 300m"
          : lang === "sc"
            ? "300米内未找到附近车站"
            : "300米內未找到附近車站",
      );
      return;
    }

    onNearbyStops(nearbyStopIds);
  }, [stops, lang, onNearbyStops, requestLocation]);

  const label = lang === "en" ? "Nearby" : lang === "sc" ? "附近" : "附近";

  return (
    <Button
      variant="outline"
      size="sm"
      className={cn("rounded-xl", disabled && "opacity-50")}
      disabled={disabled || loading || stops.length === 0}
      onClick={handleClick}
    >
      <MapPin className={cn("mr-2 h-4 w-4", loading && "animate-pulse")} />
      {loading
        ? lang === "en"
          ? "Locating..."
          : lang === "sc"
            ? "定位中..."
            : "定位中..."
        : label}
    </Button>
  );
}
