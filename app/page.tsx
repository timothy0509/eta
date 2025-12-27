"use client";

import * as React from "react";
import { Heart, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { AutoRefreshMenu } from "@/components/eta/auto-refresh";
import { FavoritesAndRecents } from "@/components/eta/favorites";
import { LanguageToggle } from "@/components/eta/language-toggle";
import { ModeTabs } from "@/components/eta/mode-tabs";
import { KmbResults } from "@/components/eta/results-kmb";
import { LrtResults } from "@/components/eta/results-lrt";
import { MtrResults } from "@/components/eta/results-mtr";
import {
  RouteFilter,
  type RouteFilterOption,
  type RouteFilterState,
} from "@/components/eta/route-filter";
import { LrtStationSearch } from "@/components/eta/lrt-stop-search";
import { MtrStationSearch } from "@/components/eta/station-search";
import { StopSearch, type StopSearchSelection } from "@/components/eta/stop-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { LRT_STATIONS } from "@/lib/data/lrt-stations";
import { MTR_STATIONS } from "@/lib/data/mtr-stations";
import { fetchKmbRouteInfo, fetchKmbRouteStops, fetchKmbStops } from "@/lib/eta/client";
import type { KmbEtaEntry } from "@/lib/eta/kmb";
import type { KmbRouteInfoLite, KmbRouteStopLite } from "@/lib/eta/client";
import type { LrtScheduleResponse } from "@/lib/eta/lrt";
import type { MtrScheduleResponse } from "@/lib/eta/mtr";
import type {
  KmbStopSearchItem,
  LrtStationSearchItem,
  MtrStationSearchItem,
  UiLanguage,
} from "@/lib/eta/types";
import { isLanguageSupported } from "@/lib/eta/types";
import { useAutoRefresh } from "@/lib/eta/use-auto-refresh";
import { useAppStore, type FavoritesItem } from "@/lib/store";
import { cn } from "@/lib/utils";

type KmbQuery =
  | {
      mode: "stop";
      stopId: string;
      route?: string;
      serviceType?: string;
    }
  | {
      mode: "contains";
      query: string;
      route?: string;
      serviceType?: string;
    };

type MtrQuery = {
  sta?: string;
};

type LrtQuery = {
  stationId?: string;
};

function pickKmbStopTitle(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "en") return stop.nameEn;
  if (lang === "sc") return stop.nameSc;
  return stop.nameTc;
}

/**
 * Parse a KMB stop name to extract the code from parentheses.
 * e.g., "Chuk Yuen Estate Bus Terminus (WT916)" → { name: "Chuk Yuen Estate Bus Terminus", code: "WT916" }
 */
function parseStopNameAndCode(fullName: string): { name: string; code: string | null } {
  const match = fullName.match(/^(.+?)\s*\(([A-Z0-9]+)\)\s*$/);
  if (match) {
    return { name: match[1].trim(), code: match[2] };
  }
  return { name: fullName, code: null };
}

export default function Home() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  const routeFilterMode = useAppStore((s) => s.routeFilterMode);
  const setRouteFilterMode = useAppStore((s) => s.setRouteFilterMode);

  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds);
  const setAutoRefreshSeconds = useAppStore((s) => s.setAutoRefreshSeconds);

  const addFavorite = useAppStore((s) => s.addFavorite);
  const addRecent = useAppStore((s) => s.addRecent);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = React.useState(false);

  React.useEffect(() => {
    setThemeMounted(true);
  }, []);

  const [kmbStops, setKmbStops] = React.useState<KmbStopSearchItem[]>([]);
  const [loadingStops, setLoadingStops] = React.useState(false);
  const [stopsError, setStopsError] = React.useState<string | null>(null);

  const [kmbRouteStops, setKmbRouteStops] = React.useState<KmbRouteStopLite[]>([]);
  const [loadingRouteStops, setLoadingRouteStops] = React.useState(false);
  const [routeStopsError, setRouteStopsError] = React.useState<string | null>(null);

  const [kmbRouteInfos, setKmbRouteInfos] = React.useState<Record<string, KmbRouteInfoLite>>({});

  const [kmbDraftStopSelection, setKmbDraftStopSelection] = React.useState<
    StopSearchSelection | undefined
  >();

  const [kmbQuery, setKmbQuery] = React.useState<KmbQuery | null>(null);
  const [routeFilter, setRouteFilter] = React.useState<RouteFilterState>({
    routes: "",
    entries: [],
  });

  const [kmbEta, setKmbEta] = React.useState<KmbEtaEntry[] | null>(null);
  const [kmbEtaLoading, setKmbEtaLoading] = React.useState(false);

  const [mtrQuery, setMtrQuery] = React.useState<MtrQuery>({});
  const [mtrSchedule, setMtrSchedule] = React.useState<MtrScheduleResponse | null>(null);
  const [mtrLoading, setMtrLoading] = React.useState(false);

  const mtrStations: MtrStationSearchItem[] = React.useMemo(
    () =>
      MTR_STATIONS.map((s) => ({
        labelId: s.sta,
        sta: s.sta,
        lines: [...s.lines],
        nameEn: s.nameEn,
        nameTc: s.nameTc,
      })),
    []
  );

  const [lrtQuery, setLrtQuery] = React.useState<LrtQuery>({});
  const [lrtSchedule, setLrtSchedule] = React.useState<LrtScheduleResponse | null>(null);
  const [lrtLoading, setLrtLoading] = React.useState(false);

  React.useEffect(() => {
    if (isLanguageSupported(mode, lang)) return;
    setLang("tc");
  }, [lang, mode, setLang]);

  React.useEffect(() => {
    if (mode !== "kmb") return;

    let cancelled = false;
    const load = async () => {
      setLoadingStops(true);
      setStopsError(null);
      try {
        const stops = await fetchKmbStops();
        if (!cancelled) setKmbStops(stops);
      } catch (e) {
        if (!cancelled) setStopsError(e instanceof Error ? e.message : "Failed to load stops");
      } finally {
        if (!cancelled) setLoadingStops(false);
      }
    };

    if (!kmbStops.length) load();
    return () => {
      cancelled = true;
    };
  }, [kmbStops.length, mode]);

  React.useEffect(() => {
    if (mode !== "kmb") return;

    let cancelled = false;
    const load = async () => {
      setLoadingRouteStops(true);
      setRouteStopsError(null);
      try {
        const data = await fetchKmbRouteStops();
        if (!cancelled) setKmbRouteStops(data);
      } catch (e) {
        if (!cancelled)
          setRouteStopsError(e instanceof Error ? e.message : "Failed to load route-stop");
      } finally {
        if (!cancelled) setLoadingRouteStops(false);
      }
    };

    if (!kmbRouteStops.length) load();
    return () => {
      cancelled = true;
    };
  }, [kmbRouteStops.length, mode]);

  function normalizeKmbRoutesInput(input: string) {
    const requestedRoutes = input
      ? input
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
          .map((r) => r.toUpperCase())
      : null;

    return requestedRoutes?.length ? requestedRoutes : null;
  }

  function stopNameContains(stop: KmbStopSearchItem, query: string) {
    const needle = query.trim().toLowerCase();
    if (!needle) return false;

    return (
      stop.nameEn.toLowerCase().includes(needle) ||
      stop.nameTc.toLowerCase().includes(needle) ||
      stop.nameSc.toLowerCase().includes(needle)
    );
  }

  const pickRouteVariantLabel = React.useCallback(
    (info: KmbRouteInfoLite | undefined) => {
      if (!info) return "";
      const origin =
        lang === "en" ? info.origin.en : lang === "sc" ? info.origin.sc : info.origin.tc;
      const destination =
        lang === "en"
          ? info.destination.en
          : lang === "sc"
            ? info.destination.sc
            : info.destination.tc;
      if (!origin || !destination) return "";
      return `${origin} → ${destination}`;
    },
    [lang]
  );

  const refreshKmbEta = React.useCallback(
    async (queryOverride?: KmbQuery | null) => {
      const query = queryOverride ?? kmbQuery;
      if (!query) return;

      const stopIds =
        query.mode === "stop"
          ? [query.stopId]
          : query.query.trim().length >= 3
            ? kmbStops
                .filter((stop) => stopNameContains(stop, query.query))
                .slice(0, 20)
                .map((stop) => stop.stopId)
            : [];

      if (!stopIds.length) return;

      // Advanced filter: only apply if there are entries; empty = show all
      const advancedEntries = routeFilterMode === "advanced" ? (routeFilter.entries ?? []) : [];
      const advancedKeys = advancedEntries.length
        ? new Set(advancedEntries.map((e) => e.variantKey).filter(Boolean))
        : null;

      const requestedRoutes = normalizeKmbRoutesInput(query.route?.trim() ?? "");
      const requestedSet = requestedRoutes ? new Set(requestedRoutes) : null;

      setKmbEtaLoading(true);
      try {
        const perStopPairs = stopIds.map((stopId) => {
          const candidates = kmbRouteStops
            .filter((entry) => entry.stopId === stopId)
            .filter((entry) => {
              const route = entry.route.toUpperCase();
              // Advanced mode with entries: filter to selected variants only
              if (advancedKeys) {
                const key = `${route}|${entry.bound}|${entry.serviceType}`;
                return advancedKeys.has(key);
              }

              // Simple mode: filter by route name if specified
              if (!requestedSet) return true;
              return requestedSet.has(route);
            });

          const uniquePairs = new Map<string, { route: string; serviceType: string }>();
          for (const entry of candidates) {
            const route = entry.route.toUpperCase();
            const serviceType = entry.serviceType;
            const key = `${route}|${serviceType}`;
            if (!uniquePairs.has(key)) uniquePairs.set(key, { route, serviceType });
          }

          return {
            stopId,
            pairs: Array.from(uniquePairs.values()).slice(0, 12),
          };
        });

        const requestPlans = perStopPairs
          .flatMap((stopPlan) =>
            stopPlan.pairs.map((pair) => ({
              stopId: stopPlan.stopId,
              route: pair.route,
              serviceType: pair.serviceType,
            }))
          )
          .slice(0, 60);

        const results = await Promise.all(
          requestPlans.map(async (plan) => {
            const response = await fetch(
              `/api/kmb/eta?stopId=${encodeURIComponent(plan.stopId)}&route=${encodeURIComponent(plan.route)}&serviceType=${encodeURIComponent(plan.serviceType)}`
            );

            if (!response.ok) {
              throw new Error(`Failed to load ETA: ${response.status}`);
            }

            const json = (await response.json()) as { eta: KmbEtaEntry[] };
            return json.eta;
          })
        );

        const merged = results.flat();
        setKmbEta(merged);

        const variantKeys = Array.from(
          new Set(
            merged.map((eta) => `${eta.route.toUpperCase()}|${eta.dir}|${String(eta.service_type)}`)
          )
        );

        const candidateKeysFromStops = Array.from(
          new Set(
            kmbRouteStops
              .filter((entry) => stopIds.includes(entry.stopId))
              .map((entry) => `${entry.route.toUpperCase()}|${entry.bound}|${entry.serviceType}`)
          )
        );

        const missingKeys = [...variantKeys, ...candidateKeysFromStops].filter(
          (key) => !kmbRouteInfos[key]
        );
        if (missingKeys.length) {
          const fetched = await Promise.allSettled(
            missingKeys.map(async (key) => {
              const [route, direction, serviceType] = key.split("|");
              const info = await fetchKmbRouteInfo({
                route,
                direction,
                serviceType,
              });
              return { key, info };
            })
          );

          const updates: Record<string, KmbRouteInfoLite> = {};
          for (const item of fetched) {
            if (item.status !== "fulfilled") continue;
            updates[item.value.key] = item.value.info;
          }

          if (Object.keys(updates).length) {
            setKmbRouteInfos((prev) => ({ ...prev, ...updates }));
          }
        }
      } finally {
        setKmbEtaLoading(false);
      }
    },
    [kmbQuery, kmbRouteInfos, kmbRouteStops, kmbStops, routeFilter.entries, routeFilterMode]
  );

  const refreshMtr = React.useCallback(async () => {
    if (!mtrQuery.sta) return;

    const station = mtrStations.find((s) => s.sta === mtrQuery.sta);
    if (!station) return;

    setMtrLoading(true);
    try {
      const mtrLang = lang === "en" ? "EN" : "TC";

      const schedules = await Promise.all(
        station.lines.map(async (line) => {
          const response = await fetch(
            `/api/mtr/schedule?line=${encodeURIComponent(line)}&sta=${encodeURIComponent(mtrQuery.sta ?? "")}&lang=${encodeURIComponent(mtrLang)}`
          );
          const json = (await response.json()) as { schedule: MtrScheduleResponse };
          return json.schedule;
        })
      );

      let baseline: MtrScheduleResponse | null = null;
      const mergedData: Record<string, NonNullable<MtrScheduleResponse["data"]>[string]> = {};

      for (const schedule of schedules) {
        baseline ??= schedule;
        if (schedule.status !== 1) continue;
        Object.assign(mergedData, schedule.data ?? {});
      }

      if (!baseline) {
        setMtrSchedule(null);
        return;
      }

      setMtrSchedule({
        ...baseline,
        status: Object.keys(mergedData).length ? 1 : baseline.status,
        data: Object.keys(mergedData).length ? mergedData : baseline.data,
      });
    } finally {
      setMtrLoading(false);
    }
  }, [lang, mtrQuery.sta, mtrStations]);

  const refreshLrt = React.useCallback(async () => {
    if (!lrtQuery.stationId) return;
    setLrtLoading(true);
    try {
      const response = await fetch(
        `/api/lrt/schedule?stationId=${encodeURIComponent(lrtQuery.stationId)}`
      );
      const json = (await response.json()) as { schedule: LrtScheduleResponse };
      setLrtSchedule(json.schedule);
    } finally {
      setLrtLoading(false);
    }
  }, [lrtQuery.stationId]);

  useAutoRefresh(autoRefreshSeconds * 1000, () => {
    if (mode === "kmb") void refreshKmbEta();
    if (mode === "mtr") void refreshMtr();
    if (mode === "lrt") void refreshLrt();
  });

  const availableStopIdsForFilter = React.useMemo(() => {
    if (!kmbDraftStopSelection) return [] as string[];

    if (kmbDraftStopSelection.type === "stop") {
      return [kmbDraftStopSelection.stopId];
    }

    const trimmed = kmbDraftStopSelection.query.trim();
    if (trimmed.length < 3) return [];

    return kmbStops
      .filter((stop) => stopNameContains(stop, trimmed))
      .slice(0, 20)
      .map((stop) => stop.stopId);
  }, [kmbDraftStopSelection, kmbStops]);

  const kmbAvailableRouteVariants: RouteFilterOption[] = React.useMemo(() => {
    if (!availableStopIdsForFilter.length) return [];

    const stopSet = new Set(availableStopIdsForFilter);
    const variantKeys = Array.from(
      new Set(
        kmbRouteStops
          .filter((entry) => stopSet.has(entry.stopId))
          .map((entry) => `${entry.route.toUpperCase()}|${entry.bound}|${entry.serviceType}`)
      )
    );

    return variantKeys
      .map((key) => {
        const [route] = key.split("|");
        const label = pickRouteVariantLabel(kmbRouteInfos[key]);
        return {
          key,
          route,
          label: label || "—",
        };
      })
      .filter((opt) => opt.route);
  }, [availableStopIdsForFilter, kmbRouteInfos, kmbRouteStops, pickRouteVariantLabel]);

  React.useEffect(() => {
    if (mode !== "kmb") return;
    if (!availableStopIdsForFilter.length) return;
    if (!kmbRouteStops.length) return;

    const stopSet = new Set(availableStopIdsForFilter);
    const variantKeys = Array.from(
      new Set(
        kmbRouteStops
          .filter((entry) => stopSet.has(entry.stopId))
          .map((entry) => `${entry.route.toUpperCase()}|${entry.bound}|${entry.serviceType}`)
      )
    );

    const missing = variantKeys.filter((key) => !kmbRouteInfos[key]);
    if (!missing.length) return;

    let cancelled = false;
    const load = async () => {
      const fetched = await Promise.allSettled(
        missing.map(async (key) => {
          const [route, direction, serviceType] = key.split("|");
          const info = await fetchKmbRouteInfo({
            route,
            direction,
            serviceType,
          });
          return { key, info };
        })
      );

      if (cancelled) return;

      const updates: Record<string, KmbRouteInfoLite> = {};
      for (const item of fetched) {
        if (item.status !== "fulfilled") continue;
        updates[item.value.key] = item.value.info;
      }

      if (Object.keys(updates).length) {
        setKmbRouteInfos((prev) => ({ ...prev, ...updates }));
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [availableStopIdsForFilter, kmbRouteInfos, kmbRouteStops, mode]);

  React.useEffect(() => {
    if (routeFilterMode !== "advanced") return;
    if (!(routeFilter.entries ?? []).length) return;

    const nextEntries = (routeFilter.entries ?? []).filter((entry) =>
      kmbAvailableRouteVariants.some((opt) => opt.key === entry.variantKey)
    );

    if (nextEntries.length === (routeFilter.entries ?? []).length) return;

    setRouteFilter((prev) => ({ ...prev, entries: nextEntries }));
    setKmbQuery(null);
    setKmbEta(null);
  }, [kmbAvailableRouteVariants, routeFilter.entries, routeFilterMode]);

  React.useEffect(() => {
    if (mode !== "mtr") return;
    if (!mtrQuery.sta) return;
    void refreshMtr();
  }, [mode, mtrQuery.sta, refreshMtr]);

  React.useEffect(() => {
    if (mode !== "lrt") return;
    if (!lrtQuery.stationId) return;
    void refreshLrt();
  }, [mode, lrtQuery.stationId, refreshLrt]);

  // Auto-fetch KMB ETAs when stop selection changes (immediate)
  const prevStopSelectionRef = React.useRef<StopSearchSelection | undefined>(undefined);
  React.useEffect(() => {
    if (mode !== "kmb") return;
    if (!kmbDraftStopSelection) return;
    if (!kmbRouteStops.length) return;

    // Only trigger on actual change
    const prev = prevStopSelectionRef.current;
    prevStopSelectionRef.current = kmbDraftStopSelection;

    const isSame =
      prev &&
      prev.type === kmbDraftStopSelection.type &&
      (prev.type === "stop"
        ? prev.stopId === (kmbDraftStopSelection as { type: "stop"; stopId: string }).stopId
        : prev.query === (kmbDraftStopSelection as { type: "contains"; query: string }).query);

    if (isSame) return;

    // Build query based on current state
    const routeInput = routeFilterMode === "simple" ? routeFilter.routes?.trim() ?? "" : "";
    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === "stop"
        ? {
            mode: "stop",
            stopId: kmbDraftStopSelection.stopId,
            route: routeInput || undefined,
            serviceType: "1",
          }
        : {
            mode: "contains",
            query: kmbDraftStopSelection.query,
            route: routeInput || undefined,
            serviceType: "1",
          };

    setKmbQuery(nextQuery);
    void refreshKmbEta(nextQuery);
  }, [mode, kmbDraftStopSelection, kmbRouteStops.length, refreshKmbEta, routeFilter.routes, routeFilterMode]);

  // Auto-fetch KMB ETAs when advanced filter entries change (immediate)
  const prevEntriesRef = React.useRef<typeof routeFilter.entries>([]);
  React.useEffect(() => {
    if (mode !== "kmb") return;
    if (routeFilterMode !== "advanced") return;
    if (!kmbDraftStopSelection) return;
    if (!kmbRouteStops.length) return;

    const prev = prevEntriesRef.current ?? [];
    const curr = routeFilter.entries ?? [];
    prevEntriesRef.current = curr;

    // Check if entries actually changed
    const prevKeys = new Set(prev.map((e) => e.variantKey));
    const currKeys = new Set(curr.map((e) => e.variantKey));
    if (prevKeys.size === currKeys.size && [...prevKeys].every((k) => currKeys.has(k))) return;

    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === "stop"
        ? { mode: "stop", stopId: kmbDraftStopSelection.stopId, serviceType: "1" }
        : { mode: "contains", query: kmbDraftStopSelection.query, serviceType: "1" };

    setKmbQuery(nextQuery);
    void refreshKmbEta(nextQuery);
  }, [mode, routeFilterMode, routeFilter.entries, kmbDraftStopSelection, kmbRouteStops.length, refreshKmbEta]);

  // Debounced auto-fetch for simple route filter input (1s delay)
  const [debouncedRoutes, setDebouncedRoutes] = React.useState(routeFilter.routes ?? "");
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRoutes(routeFilter.routes ?? "");
    }, 1000);
    return () => clearTimeout(timer);
  }, [routeFilter.routes]);

  React.useEffect(() => {
    if (mode !== "kmb") return;
    if (routeFilterMode !== "simple") return;
    if (!kmbDraftStopSelection) return;
    if (!kmbRouteStops.length) return;

    const routeInput = debouncedRoutes.trim();
    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === "stop"
        ? { mode: "stop", stopId: kmbDraftStopSelection.stopId, route: routeInput || undefined, serviceType: "1" }
        : { mode: "contains", query: kmbDraftStopSelection.query, route: routeInput || undefined, serviceType: "1" };

    setKmbQuery(nextQuery);
    void refreshKmbEta(nextQuery);
  }, [mode, routeFilterMode, debouncedRoutes, kmbDraftStopSelection, kmbRouteStops.length, refreshKmbEta]);

  const lrtStations: LrtStationSearchItem[] = React.useMemo(
    () =>
      LRT_STATIONS.map((s) => ({
        stationId: s.stationId,
        nameEn: s.nameEn,
        nameZh: s.nameZh,
      })),
    []
  );

  const heading =
    mode === "kmb" ? "KMB bus ETAs" : mode === "mtr" ? "MTR Next Train" : "Light Rail";

  // Compute KMB results title using stop name, with code parsed out
  const kmbResultsInfo = React.useMemo(() => {
    if (!kmbQuery) return { title: "KMB ETAs", code: null };
    if (kmbQuery.mode === "stop") {
      const stop = kmbStops.find((s) => s.stopId === kmbQuery.stopId);
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang);
        const parsed = parseStopNameAndCode(fullName);
        return { title: parsed.name, code: parsed.code };
      }
      return { title: `Stop ${kmbQuery.stopId}`, code: null };
    }
    return { title: lang === "en" ? `Stops containing "${kmbQuery.query.trim()}"` : `包含「${kmbQuery.query.trim()}」的車站`, code: null };
  }, [kmbQuery, kmbStops, lang]);

  // Compute MTR results title using localized station name
  const mtrResultsTitle = React.useMemo(() => {
    if (!mtrQuery.sta) return "MTR";
    const station = mtrStations.find((s) => s.sta === mtrQuery.sta);
    if (station) {
      return lang === "en" ? station.nameEn : station.nameTc;
    }
    return `Station ${mtrQuery.sta}`;
  }, [mtrQuery.sta, mtrStations, lang]);

  // Compute LRT results title using localized station name
  const lrtResultsTitle = React.useMemo(() => {
    if (!lrtQuery.stationId) return "Light Rail";
    const station = lrtStations.find((s) => s.stationId === lrtQuery.stationId);
    if (station) {
      return lang === "en" ? station.nameEn : station.nameZh;
    }
    return `Station ${lrtQuery.stationId}`;
  }, [lrtQuery.stationId, lrtStations, lang]);

  const canFavorite =
    (mode === "kmb" &&
      ((kmbQuery?.mode === "stop" && kmbQuery.stopId) ||
        (kmbQuery?.mode === "contains" && kmbQuery.query.trim().length >= 3) ||
        kmbDraftStopSelection?.type === "stop" ||
        (kmbDraftStopSelection?.type === "contains" &&
          kmbDraftStopSelection.query.trim().length >= 3))) ||
    (mode === "mtr" && mtrQuery.sta) ||
    (mode === "lrt" && lrtQuery.stationId);

  const onAddFavorite = () => {
    if (!canFavorite) return;

    let item: FavoritesItem | null = null;

    if (mode === "kmb") {
      const routeInput = routeFilterMode === "simple" ? (routeFilter.routes?.trim() ?? "") : "";
      const route = routeInput || undefined;
      const routeSuffix = route ? ` · ${route}` : "";

      const stopId =
        kmbQuery?.mode === "stop"
          ? kmbQuery.stopId
          : kmbDraftStopSelection?.type === "stop"
            ? kmbDraftStopSelection.stopId
            : null;

      const containsQuery =
        kmbQuery?.mode === "contains"
          ? kmbQuery.query.trim()
          : kmbDraftStopSelection?.type === "contains"
            ? kmbDraftStopSelection.query.trim()
            : "";

      if (stopId) {
        const stop = kmbStops.find((s) => s.stopId === stopId);
        const title = stop ? `${pickKmbStopTitle(stop, lang)}${routeSuffix}` : `KMB${routeSuffix}`;

        item = {
          id: `kmb:${stopId}:${route ?? "__all__"}:1`,
          mode: "kmb",
          title,
          stopId,
          route,
          serviceType: "1",
        };
      } else if (containsQuery.length >= 3) {
        item = {
          id: `kmb:contains:${containsQuery}:${route ?? "__all__"}:1`,
          mode: "kmb",
          title: `Contains: ${containsQuery}${routeSuffix}`,
          query: containsQuery,
          route,
          serviceType: "1",
        };
      }
    }

    if (mode === "mtr" && mtrQuery.sta) {
      const station = mtrStations.find((s) => s.sta === mtrQuery.sta);
      const name = station ? (lang === "en" ? station.nameEn : station.nameTc) : "";
      const title = station ? `${name} · ${station.lines.join("/")}/${station.sta}` : `MTR · ${mtrQuery.sta}`;
      item = {
        id: `mtr:${mtrQuery.sta}`,
        mode: "mtr",
        title,
        line: station?.lines[0] ?? "",
        sta: mtrQuery.sta,
      };
    }

    if (mode === "lrt" && lrtQuery.stationId) {
      const station = lrtStations.find((s) => s.stationId === lrtQuery.stationId);
      const name = station ? (lang === "en" ? station.nameEn : station.nameZh) : "";
      const title = station ? `${name} · ${station.stationId}` : `LRT · ${lrtQuery.stationId}`;
      item = {
        id: `lrt:${lrtQuery.stationId}`,
        mode: "lrt",
        title,
        stationId: lrtQuery.stationId,
      };
    }

    if (!item) return;
    addFavorite(item);
    addRecent(item);
  };

  const onSelectFromLists = (item: FavoritesItem) => {
    setMode(item.mode);

    if (item.mode === "kmb") {
      if ("stopId" in item) {
        setKmbDraftStopSelection({ type: "stop", stopId: item.stopId });
        const nextQuery: KmbQuery = {
          mode: "stop",
          stopId: item.stopId,
          route: item.route,
          serviceType: item.serviceType,
        };
        setKmbQuery(nextQuery);
        setRouteFilter({ ...routeFilter, routes: item.route ?? "" });
        setKmbEta(null);
        void refreshKmbEta(nextQuery);
        return;
      }

      setKmbDraftStopSelection({ type: "contains", query: item.query });
      const nextQuery: KmbQuery = {
        mode: "contains",
        query: item.query,
        route: item.route,
        serviceType: item.serviceType,
      };
      setKmbQuery(nextQuery);
      setRouteFilter({ ...routeFilter, routes: item.route ?? "" });
      setKmbEta(null);
      void refreshKmbEta(nextQuery);
      return;
    }

    if (item.mode === "mtr") {
      setMtrQuery({ sta: item.sta });
      return;
    }

    setLrtQuery({ stationId: item.stationId });
  };

  const onRefresh = () => {
    if (mode === "kmb") void refreshKmbEta(kmbQuery);
    if (mode === "mtr") void refreshMtr();
    if (mode === "lrt") void refreshLrt();
  };

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-background via-background to-muted/30">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                TimoETA
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Clean, fast ETAs for Hong Kong transit.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <AutoRefreshMenu
                valueSeconds={autoRefreshSeconds}
                onChange={setAutoRefreshSeconds}
              />
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  const actual = resolvedTheme ?? theme;
                  setTheme(actual === "dark" ? "light" : "dark");
                }}
              >
                {themeMounted ? (
                  (resolvedTheme ?? theme) === "dark" ? (
                    <Sun className="mr-2 h-4 w-4" />
                  ) : (
                    <Moon className="mr-2 h-4 w-4" />
                  )
                ) : (
                  <span className="mr-2 inline-block h-4 w-4" aria-hidden />
                )}
                Theme
              </Button>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card className="rounded-3xl border bg-card/60 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <ModeTabs value={mode} onChange={setMode} />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{heading}</div>
                      <div className="text-xs text-muted-foreground">
                        Search and pin your go-to stops.
                      </div>
                    </div>
                    <LanguageToggle
                      mode={mode}
                      value={lang}
                      onChange={setLang}
                    />
                  </div>

                  <Separator />

                  {mode === "kmb" ? (
                    <>
                      <StopSearch
                        lang={lang}
                        stops={kmbStops}
                        value={kmbDraftStopSelection}
                        onSelectStop={(stop) => {
                          setKmbDraftStopSelection({ type: "stop", stopId: stop.stopId });
                          addRecent({
                            id: `kmb:${stop.stopId}:__stop__`,
                            mode: "kmb",
                            title: pickKmbStopTitle(stop, lang),
                            stopId: stop.stopId,
                          });
                        }}
                        onSelectContains={(query) => {
                          setKmbDraftStopSelection({ type: "contains", query });
                        }}
                      />

                        <RouteFilter
                          mode={routeFilterMode}
                          onModeChange={(nextMode) => {
                            setRouteFilterMode(nextMode);
                          }}
                          value={routeFilter}
                          options={kmbRouteStops.length ? kmbAvailableRouteVariants : []}
                          onChange={(next) => {
                            setRouteFilter(next);
                          }}
                        />



                       {stopsError ? (
                         <div className="rounded-2xl border bg-background/40 p-3 text-sm text-destructive">
                           {stopsError}
                         </div>
                       ) : null}

                       {routeStopsError ? (
                         <div className="rounded-2xl border bg-background/40 p-3 text-sm text-destructive">
                           {routeStopsError}
                         </div>
                       ) : null}


                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="rounded-xl">
                          {loadingStops || loadingRouteStops
                            ? "Indexing data…"
                            : `${kmbStops.length.toLocaleString()} stops · ${kmbRouteStops.length.toLocaleString()} route-stops`}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="rounded-xl"
                          onClick={onRefresh}
                        >
                          <RefreshCw className="mr-2 h-4 w-4" />
                          Refresh
                        </Button>
                      </div>

                    </>
                  ) : null}

                  {mode === "mtr" ? (
                    <MtrStationSearch
                      lang={lang}
                      stations={mtrStations}
                      selectedSta={mtrQuery.sta}
                      onSelect={(station) => setMtrQuery({ sta: station.sta })}
                    />
                  ) : null}

                  {mode === "lrt" ? (
                    <LrtStationSearch
                      lang={lang}
                      stations={lrtStations}
                      selectedStationId={lrtQuery.stationId}
                      onSelect={(station) => setLrtQuery({ stationId: station.stationId })}
                    />
                  ) : null}

                  <Separator />

                  <div className="flex items-center justify-between gap-2">
                    <Button
                      className={cn("rounded-xl", !canFavorite && "opacity-60")}
                      disabled={!canFavorite}
                      onClick={onAddFavorite}
                    >
                      <Heart className="mr-2 h-4 w-4" />
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <FavoritesAndRecents lang={lang} onSelect={onSelectFromLists} />
            </div>

            <div className="space-y-4">
              {mode === "kmb" ? (
                  <KmbResults
                    lang={lang}
                    title={kmbResultsInfo.title}
                    stopCode={kmbResultsInfo.code}
                    routesFilter={routeFilter.routes ?? ""}
                    eta={kmbEta ?? []}
                    routeInfos={kmbRouteInfos}
                    hasQuery={Boolean(kmbQuery)}
                    onRefresh={() => void refreshKmbEta(kmbQuery)}
                    loading={kmbEtaLoading}
                  />
              ) : null}

              {mode === "mtr" ? (
                <MtrResults
                  title={mtrResultsTitle}
                  lang={lang}
                  schedule={mtrSchedule}
                  onRefresh={refreshMtr}
                  loading={mtrLoading}
                />
              ) : null}

              {mode === "lrt" ? (
                <LrtResults
                  title={lrtResultsTitle}
                  lang={lang}
                  schedule={lrtSchedule}
                  onRefresh={refreshLrt}
                  loading={lrtLoading}
                />
              ) : null}

              {mode === "mtr" ? (
                <MtrResults
                  title={mtrQuery.sta ? `Station ${mtrQuery.sta}` : "MTR"}
                  lang={lang}
                  schedule={mtrSchedule}
                  onRefresh={refreshMtr}
                  loading={mtrLoading}
                />
              ) : null}

              {mode === "lrt" ? (
                <LrtResults
                  title={lrtQuery.stationId ? `Station ${lrtQuery.stationId}` : "Light Rail"}
                  lang={lang}
                  schedule={lrtSchedule}
                  onRefresh={refreshLrt}
                  loading={lrtLoading}
                />
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
