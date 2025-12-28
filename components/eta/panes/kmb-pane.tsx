"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { StopSearch, type StopSearchSelection } from "@/components/eta/stop-search";
import {
  RouteFilter,
  type RouteFilterOption,
  type RouteFilterState,
} from "@/components/eta/route-filter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import {
  fetchKmbEtas,
  fetchKmbRouteInfo,
  fetchKmbRouteStops,
  fetchKmbStops,
  type KmbRouteInfoLite,
  type KmbRouteStopLite,
} from "@/lib/eta/client";
import type { KmbEtaEntry } from "@/lib/eta/kmb";
import type { KmbStopSearchItem, UiLanguage } from "@/lib/eta/types";
import { parseKmbStopName } from "@/lib/eta/kmb-stop-name";
import type { FavoritesItem, RouteFilterMode } from "@/lib/store";

type Props = {
  lang: UiLanguage;
  routeFilterMode: RouteFilterMode;
  onRouteFilterModeChange: (mode: RouteFilterMode) => void;
  onAddRecent: (item: FavoritesItem) => void;
  onAddFavorite: (item: FavoritesItem) => void;
  canFavoriteRef: React.MutableRefObject<boolean>;
  selectedItem?: FavoritesItem | null;
  onRegisterRefresh?: (refresh: () => Promise<void>) => void;
  onStopsChange?: (stops: KmbStopSearchItem[]) => void;
  onStateChange?: (state: KmbPaneState) => void;
};

type KmbQuery =
  | {
      mode: "stop";
      stopId: string;
      route?: string;
      serviceType?: string;
    }
  | {
      mode: "stops";
      stopIds: string[];
      route?: string;
      serviceType?: string;
    }
  | {
      mode: "contains";
      query: string;
      route?: string;
      serviceType?: string;
    };

function pickKmbStopTitle(stop: KmbStopSearchItem, lang: UiLanguage) {
  if (lang === "en") return stop.nameEn;
  if (lang === "sc") return stop.nameSc;
  return stop.nameTc;
}

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

export type KmbPaneState = {
  lang: UiLanguage;
  routeFilter: RouteFilterState;
  routeInfos: Record<string, KmbRouteInfoLite>;
  eta: KmbEtaEntry[];
  loading: boolean;
  hasQuery: boolean;
  multipleStops: boolean;
  title: string;
  stopCode: string | null;
  stops: KmbStopSearchItem[];
  refresh: () => Promise<void>;
};

export function KmbPane({
  lang,
  routeFilterMode,
  onRouteFilterModeChange,
  onAddRecent,
  onAddFavorite,
  canFavoriteRef,
  selectedItem,
  onRegisterRefresh,
  onStopsChange,
  onStateChange,
}: Props) {
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

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingStops(true);
      setStopsError(null);
      try {
        const stops = await fetchKmbStops();
        if (cancelled) return;
        setKmbStops(stops);
        onStopsChange?.(stops);
      } catch (error) {
        if (!cancelled) setStopsError(error instanceof Error ? error.message : "Failed to load stops");
      } finally {
        if (!cancelled) setLoadingStops(false);
      }
    };

    if (!kmbStops.length) void load();

    return () => {
      cancelled = true;
    };
  }, [kmbStops.length, onStopsChange]);

  React.useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingRouteStops(true);
      setRouteStopsError(null);
      try {
        const data = await fetchKmbRouteStops();
        if (!cancelled) setKmbRouteStops(data);
      } catch (error) {
        if (!cancelled)
          setRouteStopsError(error instanceof Error ? error.message : "Failed to load route-stop");
      } finally {
        if (!cancelled) setLoadingRouteStops(false);
      }
    };

    if (!kmbRouteStops.length) void load();

    return () => {
      cancelled = true;
    };
  }, [kmbRouteStops.length]);

  const availableStopIdsForFilter = React.useMemo(() => {
    if (!kmbDraftStopSelection) return [] as string[];

    if (kmbDraftStopSelection.type === "stop") {
      return [kmbDraftStopSelection.stopId];
    }

    if (kmbDraftStopSelection.type === "stops") {
      return kmbDraftStopSelection.stopIds;
    }

    const trimmed = kmbDraftStopSelection.query.trim();
    if (trimmed.length < 3) return [];

    return kmbStops
      .filter((stop) => stopNameContains(stop, trimmed))
      .slice(0, 20)
      .map((stop) => stop.stopId);
  }, [kmbDraftStopSelection, kmbStops]);

  const pickRouteVariantLabel = React.useCallback(
    (info: KmbRouteInfoLite | undefined) => {
      if (!info) return "";
      const origin = lang === "en" ? info.origin.en : lang === "sc" ? info.origin.sc : info.origin.tc;
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
          const info = await fetchKmbRouteInfo({ route, direction, serviceType });
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
  }, [availableStopIdsForFilter, kmbRouteInfos, kmbRouteStops]);

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

  const refreshKmbEta = React.useCallback(
    async (queryOverride?: KmbQuery | null) => {
      const query = queryOverride ?? kmbQuery;
      if (!query) return;

      const stopIds =
        query.mode === "stop"
          ? [query.stopId]
          : query.mode === "stops"
            ? query.stopIds
            : query.query.trim().length >= 3
              ? kmbStops
                  .filter((stop) => stopNameContains(stop, query.query))
                  .slice(0, 20)
                  .map((stop) => stop.stopId)
              : [];

      if (!stopIds.length) return;

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
              if (advancedKeys) {
                const key = `${route}|${entry.bound}|${entry.serviceType}`;
                return advancedKeys.has(key);
              }

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
            pairs: Array.from(uniquePairs.values()),
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

        const json = await fetchKmbEtas(requestPlans);

        setKmbEta(json.eta);

        const variantKeys = Array.from(
          new Set(
            json.eta.map(
              (eta) => `${eta.route.toUpperCase()}|${eta.dir}|${String(eta.service_type)}`
            )
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
          (key) => !kmbRouteInfos[key as string]
        ) as string[];

        if (missingKeys.length) {
          const fetched = await Promise.allSettled(
            missingKeys.map(async (key) => {
              const [route, direction, serviceType] = key.split("|");
              const info = await fetchKmbRouteInfo({ route, direction, serviceType });
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

  const refreshKmbEtaRef = React.useRef(refreshKmbEta);
  React.useEffect(() => {
    refreshKmbEtaRef.current = refreshKmbEta;
  }, [refreshKmbEta]);

  React.useEffect(() => {
    if (!onRegisterRefresh) return;
    onRegisterRefresh(() => refreshKmbEtaRef.current(kmbQuery));
  }, [kmbQuery, onRegisterRefresh]);

  const lastSelectedIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!selectedItem || selectedItem.mode !== "kmb") return;
    if (selectedItem.id === lastSelectedIdRef.current) return;
    lastSelectedIdRef.current = selectedItem.id;

    const nextRouteFilterMode = selectedItem.routeFilterMode ?? "simple";
    if (nextRouteFilterMode !== routeFilterMode) {
      onRouteFilterModeChange(nextRouteFilterMode);
    }

    const restoredEntries = (selectedItem.entries ?? []).map((entry, idx) => ({
      id: `restored-${idx}`,
      variantKey: entry.variantKey,
    }));

    setRouteFilter({
      routes: selectedItem.route ?? "",
      entries: restoredEntries,
    });

    if ("stopId" in selectedItem) {
      setKmbDraftStopSelection({ type: "stop", stopId: selectedItem.stopId });
    } else if ("stopIds" in selectedItem) {
      setKmbDraftStopSelection({ type: "stops", stopIds: selectedItem.stopIds });
    } else if ("query" in selectedItem) {
      setKmbDraftStopSelection({ type: "contains", query: selectedItem.query });
    }

    setKmbQuery(null);
    setKmbEta(null);
  }, [onRouteFilterModeChange, routeFilterMode, selectedItem]);

  const prevStopSelectionRef = React.useRef<StopSearchSelection | undefined>(undefined);
  React.useEffect(() => {
    if (!kmbDraftStopSelection) return;
    if (!kmbRouteStops.length) return;

    const prev = prevStopSelectionRef.current;
    prevStopSelectionRef.current = kmbDraftStopSelection;

    const isSame =
      prev &&
      prev.type === kmbDraftStopSelection.type &&
      (prev.type === "stop"
        ? prev.stopId === (kmbDraftStopSelection as { type: "stop"; stopId: string }).stopId
        : prev.type === "stops"
          ? JSON.stringify((prev as { type: "stops"; stopIds: string[] }).stopIds) ===
            JSON.stringify(
              (kmbDraftStopSelection as { type: "stops"; stopIds: string[] }).stopIds
            )
          : (prev as { type: "contains"; query: string }).query ===
            (kmbDraftStopSelection as { type: "contains"; query: string }).query);

    if (isSame) return;

    const routeInput = routeFilterMode === "simple" ? routeFilter.routes?.trim() ?? "" : "";
    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === "stop"
        ? {
            mode: "stop",
            stopId: kmbDraftStopSelection.stopId,
            route: routeInput || undefined,
            serviceType: "1",
          }
        : kmbDraftStopSelection.type === "stops"
          ? {
              mode: "stops",
              stopIds: kmbDraftStopSelection.stopIds,
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
    void refreshKmbEtaRef.current(nextQuery);
  }, [kmbDraftStopSelection, kmbRouteStops.length, routeFilter.routes, routeFilterMode]);

  React.useEffect(() => {
    if (!selectedItem) return;
    if (selectedItem.mode !== "kmb") return;
    if (selectedItem.id !== lastSelectedIdRef.current) return;

    let nextQuery: KmbQuery | null = null;

    if ("stopId" in selectedItem) {
      nextQuery = {
        mode: "stop",
        stopId: selectedItem.stopId,
        route: selectedItem.route,
        serviceType: selectedItem.serviceType,
      };
    } else if ("stopIds" in selectedItem) {
      nextQuery = {
        mode: "stops",
        stopIds: selectedItem.stopIds,
        route: selectedItem.route,
        serviceType: "1",
      };
    } else if ("query" in selectedItem) {
      nextQuery = {
        mode: "contains",
        query: selectedItem.query,
        route: selectedItem.route,
        serviceType: selectedItem.serviceType,
      };
    }

    if (!nextQuery) return;

    setKmbQuery(nextQuery);
    void refreshKmbEtaRef.current(nextQuery);
  }, [selectedItem]);

  const prevEntriesRef = React.useRef<typeof routeFilter.entries>([]);
  React.useEffect(() => {
    if (routeFilterMode !== "advanced") return;
    if (!kmbDraftStopSelection) return;
    if (!kmbRouteStops.length) return;

    const prev = prevEntriesRef.current ?? [];
    const curr = routeFilter.entries ?? [];
    prevEntriesRef.current = curr;

    const prevKeys = new Set(prev.map((e) => e.variantKey));
    const currKeys = new Set(curr.map((e) => e.variantKey));
    if (prevKeys.size === currKeys.size && [...prevKeys].every((k) => currKeys.has(k))) return;

    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === "stop"
        ? { mode: "stop", stopId: kmbDraftStopSelection.stopId, serviceType: "1" }
        : kmbDraftStopSelection.type === "stops"
          ? { mode: "stops", stopIds: kmbDraftStopSelection.stopIds, serviceType: "1" }
          : { mode: "contains", query: kmbDraftStopSelection.query, serviceType: "1" };

    setKmbQuery(nextQuery);
    void refreshKmbEtaRef.current(nextQuery);
  }, [routeFilterMode, routeFilter.entries, kmbDraftStopSelection, kmbRouteStops.length]);

  const [debouncedRoutes, setDebouncedRoutes] = React.useState(routeFilter.routes ?? "");
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedRoutes(routeFilter.routes ?? "");
    }, 1000);
    return () => clearTimeout(timer);
  }, [routeFilter.routes]);

  React.useEffect(() => {
    if (routeFilterMode !== "simple") return;
    if (!kmbDraftStopSelection) return;
    if (!kmbRouteStops.length) return;

    const routeInput = debouncedRoutes.trim();
    const nextQuery: KmbQuery =
      kmbDraftStopSelection.type === "stop"
        ? { mode: "stop", stopId: kmbDraftStopSelection.stopId, route: routeInput || undefined, serviceType: "1" }
        : kmbDraftStopSelection.type === "stops"
          ? { mode: "stops", stopIds: kmbDraftStopSelection.stopIds, route: routeInput || undefined, serviceType: "1" }
          : { mode: "contains", query: kmbDraftStopSelection.query, route: routeInput || undefined, serviceType: "1" };

    setKmbQuery(nextQuery);
    void refreshKmbEtaRef.current(nextQuery);
  }, [routeFilterMode, debouncedRoutes, kmbDraftStopSelection, kmbRouteStops.length]);

  const kmbResultsInfo = React.useMemo(() => {
    if (!kmbQuery) return { title: "KMB ETAs", code: null };
    if (kmbQuery.mode === "stop") {
      const stop = kmbStops.find((s) => s.stopId === kmbQuery.stopId);
      if (stop) {
        const fullName = pickKmbStopTitle(stop, lang);
        const parsed = parseKmbStopName(fullName);
        return { title: parsed.name, code: parsed.stopCode };
      }
      return { title: `Stop ${kmbQuery.stopId}`, code: null };
    }
    if (kmbQuery.mode === "stops") {
      const firstStop = kmbStops.find((s) => kmbQuery.stopIds.includes(s.stopId));
      if (firstStop) {
        const fullName = pickKmbStopTitle(firstStop, lang);
        const parsed = parseKmbStopName(fullName);
        return { title: parsed.name, code: null };
      }
      return { title: lang === "en" ? "Selected stops" : "已選車站", code: null };
    }
    return {
      title:
        lang === "en"
          ? `Stops containing "${kmbQuery.query.trim()}"`
          : `包含「${kmbQuery.query.trim()}」的車站`,
      code: null,
    };
  }, [kmbQuery, kmbStops, lang]);

  const canFavorite =
    (kmbQuery?.mode === "stop" && kmbQuery.stopId) ||
    (kmbQuery?.mode === "stops" && kmbQuery.stopIds.length > 0) ||
    (kmbQuery?.mode === "contains" && kmbQuery.query.trim().length >= 3) ||
    kmbDraftStopSelection?.type === "stop" ||
    (kmbDraftStopSelection?.type === "stops" && kmbDraftStopSelection.stopIds.length > 0) ||
    (kmbDraftStopSelection?.type === "contains" && kmbDraftStopSelection.query.trim().length >= 3);

  React.useEffect(() => {
    canFavoriteRef.current = Boolean(canFavorite);
  }, [canFavorite, canFavoriteRef]);

  const onSave = () => {
    if (!canFavorite) return;

    const isAdvanced = routeFilterMode === "advanced";
    const routeInput = isAdvanced ? "" : (routeFilter.routes?.trim() ?? "");
    const route = routeInput || undefined;

    const entriesForSave =
      isAdvanced && routeFilter.entries?.length
        ? routeFilter.entries.map((e) => ({ variantKey: e.variantKey }))
        : undefined;

    const routeCount = isAdvanced ? (routeFilter.entries?.length ?? 0) : 0;
    const routeSuffix =
      isAdvanced && routeCount > 0
        ? ` · ${routeCount} ${routeCount === 1 ? "route" : "routes"}`
        : route
          ? ` · ${route}`
          : "";

    const stopId =
      kmbQuery?.mode === "stop"
        ? kmbQuery.stopId
        : kmbDraftStopSelection?.type === "stop"
          ? kmbDraftStopSelection.stopId
          : null;

    const stopIds =
      kmbQuery?.mode === "stops"
        ? kmbQuery.stopIds
        : kmbDraftStopSelection?.type === "stops"
          ? kmbDraftStopSelection.stopIds
          : null;

    const containsQuery =
      kmbQuery?.mode === "contains"
        ? kmbQuery.query.trim()
        : kmbDraftStopSelection?.type === "contains"
          ? kmbDraftStopSelection.query.trim()
          : "";

    let item: FavoritesItem | null = null;

    if (stopId) {
      const stop = kmbStops.find((s) => s.stopId === stopId);
      const fullName = stop ? pickKmbStopTitle(stop, lang) : "KMB";
      const { name } = parseKmbStopName(fullName);
      const title = `${name}${routeSuffix}`;

      const idPart = isAdvanced ? `adv:${routeCount}` : (route ?? "__all__");
      item = {
        id: `kmb:${stopId}:${idPart}:1`,
        mode: "kmb",
        title,
        stopId,
        routeFilterMode,
        route,
        serviceType: "1",
        entries: entriesForSave,
      };
    } else if (stopIds && stopIds.length > 0) {
      const firstStop = kmbStops.find((s) => stopIds.includes(s.stopId));
      const fullName = firstStop ? pickKmbStopTitle(firstStop, lang) : "Selected Stops";
      const { name } = parseKmbStopName(fullName);
      const title = `${name}${routeSuffix}`;

      const idPart = isAdvanced ? `adv:${routeCount}` : (route ?? "__all__");
      item = {
        id: `kmb:stops:${stopIds.join(",")}:${idPart}`,
        mode: "kmb",
        title,
        stopIds,
        routeFilterMode,
        route,
        entries: entriesForSave,
      };
    } else if (containsQuery.length >= 3) {
      const title = `Contains: ${containsQuery}${routeSuffix}`;

      const idPart = isAdvanced ? `adv:${routeCount}` : (route ?? "__all__");
      item = {
        id: `kmb:contains:${containsQuery}:${idPart}:1`,
        mode: "kmb",
        title,
        query: containsQuery,
        routeFilterMode,
        route,
        serviceType: "1",
        entries: entriesForSave,
      };
    }

    if (!item) return;

    onAddFavorite(item);
    onAddRecent(item);
  };

  const paneState = React.useMemo<KmbPaneState>(
    () => ({
      lang,
      routeFilter,
      routeInfos: kmbRouteInfos,
      eta: kmbEta ?? [],
      loading: kmbEtaLoading,
      hasQuery: Boolean(kmbQuery),
      multipleStops: kmbQuery?.mode === "stops" || kmbQuery?.mode === "contains",
      title: kmbResultsInfo.title,
      stopCode: kmbResultsInfo.code,
      stops: kmbStops,
      refresh: () => refreshKmbEta(kmbQuery),
    }),
    [
      kmbEta,
      kmbEtaLoading,
      kmbQuery,
      kmbResultsInfo.code,
      kmbResultsInfo.title,
      kmbRouteInfos,
      kmbStops,
      lang,
      refreshKmbEta,
      routeFilter,
    ]
  );

  React.useEffect(() => {
    onStateChange?.(paneState);
  }, [onStateChange, paneState]);

  return (
    <div className="space-y-4">
      <StopSearch
        lang={lang}
        stops={kmbStops}
        value={kmbDraftStopSelection}
        onSelectStop={(stop) => {
          setKmbDraftStopSelection({ type: "stop", stopId: stop.stopId });
          onAddRecent({
            id: `kmb:${stop.stopId}:__stop__`,
            mode: "kmb",
            title: pickKmbStopTitle(stop, lang),
            stopId: stop.stopId,
          });
        }}
        onSelectStops={(stops) => {
          const stopIds = stops.map((s) => s.stopId);
          setKmbDraftStopSelection({ type: "stops", stopIds });
          if (stops.length > 0) {
            const firstStop = stops[0];
            const fullName = pickKmbStopTitle(firstStop, lang);
            const { name } = parseKmbStopName(fullName);
            onAddRecent({
              id: `kmb:${stopIds.join(",")}:__stops__`,
              mode: "kmb",
              title: name,
              stopId: stopIds[0],
            });
          }
        }}
        onSelectContains={(query) => {
          setKmbDraftStopSelection({ type: "contains", query });
        }}
      />

      <RouteFilter
        mode={routeFilterMode}
        onModeChange={onRouteFilterModeChange}
        value={routeFilter}
        options={kmbRouteStops.length ? kmbAvailableRouteVariants : []}
        onChange={(next) => setRouteFilter(next)}
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
          onClick={() => void refreshKmbEta(kmbQuery)}
        >
          <RefreshCw className={cn("mr-2 h-4 w-4", kmbEtaLoading && "ui-spin")} />
          Refresh
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between gap-2">
        <Button
          className={cn("rounded-xl", !canFavorite && "opacity-60")}
          disabled={!canFavorite}
          onClick={onSave}
        >
          Save
        </Button>
      </div>

    </div>
  );
}
