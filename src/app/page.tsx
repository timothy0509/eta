"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  Density,
  Eta,
  EtaDbPayload,
  EtaQuery,
  Language,
  LocationPoint,
  Mode,
  NameText,
  RouteListEntry,
  StopListEntry,
  StopRoute,
  Theme,
} from "~/lib/types";

type RouteEntry = RouteListEntry & { routeId: string };
type StopEntry = StopListEntry & { stopId: string };

const strings = {
  zh: {
    appTitle: "香港巴士到站",
    appSubtitle: "跨营办巴士实时到站资讯",
    modeRoute: "路线模式",
    modeStop: "车站模式",
    modeNearby: "附近模式",
    language: "语言",
    theme: "主题",
    density: "密度",
    densityCompact: "紧凑",
    densityBalanced: "标准",
    densitySpacious: "宽松",
    searchRoute: "搜寻路线",
    searchStop: "搜寻车站",
    filterRoutes: "过滤路线",
    routeList: "路线列表",
    stopList: "车站列表",
    routeStops: "路线车站",
    selectStop: "选择车站",
    etas: "到站时间",
    updatedAt: "更新",
    refreshAuto: "每30秒自动更新",
    noResults: "没有结果",
    selectRouteHint: "先选择路线，再选择车站",
    selectStopHint: "先选择车站，再选择路线",
    locationTitle: "附近车站",
    locationHint: "开启定位以寻找附近车站",
    locationRequest: "开始定位",
    locationDenied: "无法取得定位，请检查浏览器权限",
    nearbyRadius: "范围",
    meters: "米",
    kilometers: "公里",
    etaUnavailable: "暂无班次",
    routeFilterPlaceholder: "路线编号 / 起点 / 终点",
    stopFilterPlaceholder: "车站名称 / 编号",
    routeSearchPlaceholder: "路线编号 / 起点 / 终点",
    stopSearchPlaceholder: "车站名称 / 编号",
    company: "公司",
    stopDistance: "距离",
    chooseRoute: "选择路线",
    chooseStop: "选择车站",
    loading: "加载中…",
    dataError: "加载失败，请稍后再试",
    etaError: "无法取得到站资讯",
  },
  en: {
    appTitle: "HK Bus ETA",
    appSubtitle: "Cross-company bus arrival information",
    modeRoute: "Route mode",
    modeStop: "Stop mode",
    modeNearby: "Nearby mode",
    language: "Language",
    theme: "Theme",
    density: "Density",
    densityCompact: "Compact",
    densityBalanced: "Balanced",
    densitySpacious: "Spacious",
    searchRoute: "Search route",
    searchStop: "Search stop",
    filterRoutes: "Filter routes",
    routeList: "Routes",
    stopList: "Stops",
    routeStops: "Route stops",
    selectStop: "Select a stop",
    etas: "ETAs",
    updatedAt: "Updated",
    refreshAuto: "Auto refresh every 30s",
    noResults: "No results",
    selectRouteHint: "Select a route, then choose a stop",
    selectStopHint: "Select a stop, then choose a route",
    locationTitle: "Nearby stops",
    locationHint: "Enable location to find nearby stops",
    locationRequest: "Use my location",
    locationDenied: "Unable to access location. Please check permissions.",
    nearbyRadius: "Radius",
    meters: "m",
    kilometers: "km",
    etaUnavailable: "No upcoming service",
    routeFilterPlaceholder: "Route / origin / destination",
    stopFilterPlaceholder: "Stop name / id",
    routeSearchPlaceholder: "Route / origin / destination",
    stopSearchPlaceholder: "Stop name / id",
    company: "Company",
    stopDistance: "Distance",
    chooseRoute: "Choose route",
    chooseStop: "Choose stop",
    loading: "Loading…",
    dataError: "Failed to load data",
    etaError: "Unable to fetch ETAs",
  },
} as const satisfies Record<Language, Record<string, string>>;

const densityOptions: Density[] = ["compact", "balanced", "spacious"];
const radiusOptions = [300, 500, 800, 1200] as const;

const normalizeText = (value: string) =>
  value.toLowerCase().replace(/\s+/g, "").trim();

const getName = (name: NameText, language: Language) =>
  language === "zh" ? name.zh : name.en;

const formatDistance = (meters: number, language: Language) => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} ${strings[language].kilometers}`;
  }
  return `${Math.round(meters)} ${strings[language].meters}`;
};

const toRad = (value: number) => (value * Math.PI) / 180;
const distanceMeters = (a: LocationPoint, b: LocationPoint) => {
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const value =
    sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earthRadius * Math.asin(Math.sqrt(value));
};

const sortRoutes = (a: StopRoute, b: StopRoute) =>
  a.route.localeCompare(b.route, "zh-HK", { numeric: true });

const sortRoutesByRoute = (a: RouteEntry, b: RouteEntry) =>
  a.route.localeCompare(b.route, "zh-HK", { numeric: true });

export default function HomePage() {
  const [language, setLanguage] = useState<Language>("zh");
  const [theme, setTheme] = useState<Theme>("light");
  const [density, setDensity] = useState<Density>("balanced");
  const [mode, setMode] = useState<Mode>("route");
  const [etaDb, setEtaDb] = useState<EtaDbPayload | null>(null);
  const [dbStatus, setDbStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );

  const [routeQuery, setRouteQuery] = useState("");
  const [stopQuery, setStopQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState("");

  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [selectedStopSeq, setSelectedStopSeq] = useState<number | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectedStopRouteKey, setSelectedStopRouteKey] = useState<string | null>(
    null
  );

  const [etaQuery, setEtaQuery] = useState<EtaQuery | null>(null);
  const [etas, setEtas] = useState<Eta[]>([]);
  const [etaStatus, setEtaStatus] = useState<"idle" | "loading" | "error">(
    "idle"
  );
  const [etaUpdatedAt, setEtaUpdatedAt] = useState<number | null>(null);

  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "ready">(
    "idle"
  );
  const [geoError, setGeoError] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [nearbyRadius, setNearbyRadius] = useState<(typeof radiusOptions)[number]>(
    500
  );

  const locale = strings[language];

  useEffect(() => {
    const stored = localStorage.getItem("eta-settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          language?: Language;
          theme?: Theme;
          density?: Density;
        };
        if (parsed.language) setLanguage(parsed.language);
        if (parsed.theme) setTheme(parsed.theme);
        if (parsed.density) setDensity(parsed.density);
      } catch {
        // ignore invalid storage
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "eta-settings",
      JSON.stringify({ language, theme, density })
    );
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = density;
    document.documentElement.lang = language;
  }, [language, theme, density]);

  useEffect(() => {
    let cancelled = false;
    setDbStatus("loading");
    fetch("/api/eta-db", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed");
        return (await response.json()) as EtaDbPayload;
      })
      .then((data) => {
        if (cancelled) return;
        setEtaDb(data);
        setDbStatus("idle");
      })
      .catch(() => {
        if (cancelled) return;
        setDbStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const routeEntries = useMemo<RouteEntry[]>(() => {
    if (!etaDb) return [];
    return Object.entries(etaDb.routeList)
      .map(([routeId, route]) => ({ ...route, routeId }))
      .sort(sortRoutesByRoute);
  }, [etaDb]);

  const stopEntries = useMemo<StopEntry[]>(() => {
    if (!etaDb) return [];
    return Object.entries(etaDb.stopList).map(([stopId, stop]) => ({
      ...stop,
      stopId,
    }));
  }, [etaDb]);

  const stopRouteMap = useMemo(() => {
    const map = new Map<string, StopRoute[]>();
    if (!etaDb) return map;

    Object.entries(etaDb.routeList).forEach(([routeId, route]) => {
      Object.entries(route.stops).forEach(([company, stops]) => {
        stops.forEach((stopId, seq) => {
          const list = map.get(stopId) ?? [];
          list.push({
            routeId,
            company,
            seq,
            route: route.route,
            orig: route.orig,
            dest: route.dest,
            bound: route.bound[company] ?? "",
            serviceType: route.serviceType,
          });
          map.set(stopId, list);
        });
      });
    });

    map.forEach((value, key) => {
      map.set(key, [...value].sort(sortRoutes));
    });

    return map;
  }, [etaDb]);

  const selectedRoute = selectedRouteId
    ? etaDb?.routeList[selectedRouteId]
    : null;

  const availableCompanies = useMemo(() => {
    if (!selectedRoute) return [];
    return Object.keys(selectedRoute.stops);
  }, [selectedRoute]);

  useEffect(() => {
    if (!selectedRoute) return;
    if (!selectedCompany || !selectedRoute.stops[selectedCompany]) {
      const fallback = availableCompanies[0] ?? selectedRoute.co[0];
      if (fallback) setSelectedCompany(fallback);
    }
  }, [availableCompanies, selectedCompany, selectedRoute]);

  const routeResults = useMemo(() => {
    const normalized = normalizeText(routeQuery);
    if (!normalized) return routeEntries.slice(0, 30);
    return routeEntries
      .filter((route) => {
        const content = normalizeText(
          `${route.route} ${route.orig.zh} ${route.dest.zh} ${route.orig.en} ${route.dest.en}`
        );
        return content.includes(normalized);
      })
      .slice(0, 50);
  }, [routeEntries, routeQuery]);

  const stopResults = useMemo(() => {
    const normalized = normalizeText(stopQuery);
    if (!normalized) return stopEntries.slice(0, 30);
    return stopEntries
      .filter((stop) => {
        const content = normalizeText(
          `${stop.stopId} ${stop.name.zh} ${stop.name.en}`
        );
        return content.includes(normalized);
      })
      .slice(0, 50);
  }, [stopEntries, stopQuery]);

  const stopsForRoute = useMemo(() => {
    if (!selectedRoute || !selectedCompany) return [];
    const stops = selectedRoute.stops[selectedCompany] ?? [];
    return stops.map((stopId, seq) => ({ stopId, seq }));
  }, [selectedCompany, selectedRoute]);

  const stopRoutes = useMemo(() => {
    if (!selectedStopId) return [];
    return stopRouteMap.get(selectedStopId) ?? [];
  }, [selectedStopId, stopRouteMap]);

  const uniqueCompaniesForStop = useMemo(() => {
    return Array.from(new Set(stopRoutes.map((route) => route.company)));
  }, [stopRoutes]);

  const [companyFilter, setCompanyFilter] = useState<string>("all");

  useEffect(() => {
    if (!uniqueCompaniesForStop.includes(companyFilter)) {
      setCompanyFilter("all");
    }
  }, [companyFilter, uniqueCompaniesForStop]);

  const filteredStopRoutes = useMemo(() => {
    const normalized = normalizeText(routeFilter);
    return stopRoutes.filter((route) => {
      if (companyFilter !== "all" && route.company !== companyFilter) {
        return false;
      }
      if (!normalized) return true;
      const content = normalizeText(
        `${route.route} ${route.orig.zh} ${route.dest.zh} ${route.orig.en} ${route.dest.en}`
      );
      return content.includes(normalized);
    });
  }, [companyFilter, routeFilter, stopRoutes]);

  const fetchEtas = useCallback(
    async (query: EtaQuery, silent = false) => {
      if (!silent) setEtaStatus("loading");
      try {
        const response = await fetch("/api/etas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...query, language }),
        });
        if (!response.ok) throw new Error("Failed");
        const data = (await response.json()) as {
          etas: Eta[];
          updatedAt: number;
        };
        setEtas(data.etas ?? []);
        setEtaUpdatedAt(data.updatedAt ?? Date.now());
        setEtaStatus("idle");
      } catch {
        setEtaStatus("error");
      }
    },
    [language]
  );

  useEffect(() => {
    if (!etaQuery) return;
    fetchEtas(etaQuery);
  }, [etaQuery, fetchEtas]);

  useEffect(() => {
    if (!etaQuery) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      fetchEtas(etaQuery, true);
    }, 30000);
    return () => window.clearInterval(timer);
  }, [etaQuery, fetchEtas]);

  const selectedStopDetails = selectedStopId
    ? etaDb?.stopList[selectedStopId]
    : null;

  const etaDetails = useMemo(() => {
    if (!etaQuery || !etaDb) return null;
    const route = etaDb.routeList[etaQuery.routeId];
    if (!route) return null;
    const stops = route.stops[etaQuery.company];
    if (!stops) return null;
    const stopId = stops[etaQuery.seq];
    const stop = stopId ? etaDb.stopList[stopId] : null;
    return {
      route,
      stop,
      company: etaQuery.company,
      stopId: stopId ?? null,
    };
  }, [etaDb, etaQuery]);

  const nearbyStops = useMemo(() => {
    if (!location || !etaDb) return [];
    return stopEntries
      .map((stop) => ({
        stop,
        distance: distanceMeters(location, stop.location),
      }))
      .filter((item) => item.distance <= nearbyRadius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 30);
  }, [etaDb, location, nearbyRadius, stopEntries]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoError(locale.locationDenied);
      return;
    }
    setGeoStatus("loading");
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setGeoStatus("ready");
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        setGeoStatus("idle");
        setGeoError(locale.locationDenied);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 15000 }
    );
  };

  const handleSelectRoute = (routeId: string) => {
    setSelectedRouteId(routeId);
    setSelectedStopSeq(null);
    setSelectedStopId(null);
    setSelectedStopRouteKey(null);
    setEtaQuery(null);
    setEtas([]);
    setEtaUpdatedAt(null);
  };

  const handleSelectStopSeq = (seq: number) => {
    if (!selectedRouteId || !selectedCompany) return;
    setSelectedStopSeq(seq);
    setEtaQuery({ routeId: selectedRouteId, company: selectedCompany, seq });
  };

  const handleSelectStop = (stopId: string) => {
    setSelectedStopId(stopId);
    setSelectedStopRouteKey(null);
    setSelectedRouteId(null);
    setSelectedStopSeq(null);
    setEtaQuery(null);
    setEtas([]);
    setEtaUpdatedAt(null);
  };

  const handleSelectStopRoute = (route: StopRoute) => {
    const key = `${route.routeId}-${route.company}-${route.seq}`;
    setSelectedStopRouteKey(key);
    setEtaQuery({
      routeId: route.routeId,
      company: route.company,
      seq: route.seq,
    });
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 lg:py-12">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="chip">HK BUS ETA</span>
              <span className="chip">Open Data</span>
            </div>
            <h1 className="text-3xl font-semibold text-[color:var(--text)] md:text-4xl">
              {locale.appTitle}
            </h1>
            <p className="text-sm text-[color:var(--text-muted)] md:text-base">
              {locale.appSubtitle}
            </p>
          </div>
          <div className="card flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-[color:var(--text-faint)]">
                {locale.language}
              </span>
              <div className="segment">
                {["zh", "en"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-active={language === value}
                    onClick={() => setLanguage(value as Language)}
                  >
                    {value === "zh" ? "中文" : "EN"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-[color:var(--text-faint)]">
                {locale.theme}
              </span>
              <div className="segment">
                {["light", "dark"].map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-active={theme === value}
                    onClick={() => setTheme(value as Theme)}
                  >
                    {value === "light" ? "Light" : "Dark"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase text-[color:var(--text-faint)]">
                {locale.density}
              </span>
              <div className="segment">
                {densityOptions.map((value) => (
                  <button
                    key={value}
                    type="button"
                    data-active={density === value}
                    onClick={() => setDensity(value)}
                  >
                    {value === "compact"
                      ? locale.densityCompact
                      : value === "spacious"
                        ? locale.densitySpacious
                        : locale.densityBalanced}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        <section className="card flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              <span className="section-title">{locale.chooseRoute}</span>
              <p className="text-xs text-[color:var(--text-faint)]">
                {locale.refreshAuto}
              </p>
            </div>
            <div className="segment">
              {(
                [
                  { value: "route", label: locale.modeRoute },
                  { value: "stop", label: locale.modeStop },
                  { value: "nearby", label: locale.modeNearby },
                ] as const
              ).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  data-active={mode === item.value}
                  onClick={() => setMode(item.value)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
            <div className="flex flex-col gap-6">
              {mode === "route" && (
                <div className="panel flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <span className="section-title">{locale.searchRoute}</span>
                    <input
                      className="input"
                      value={routeQuery}
                      onChange={(event) => setRouteQuery(event.target.value)}
                      placeholder={locale.routeSearchPlaceholder}
                    />
                  </div>
                  {dbStatus === "loading" && (
                    <p className="text-sm text-[color:var(--text-muted)]">
                      {locale.loading}
                    </p>
                  )}
                  {dbStatus === "error" && (
                    <p className="text-sm text-[color:var(--text-muted)]">
                      {locale.dataError}
                    </p>
                  )}
                  <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-2">
                    {routeResults.length === 0 ? (
                      <p className="text-sm text-[color:var(--text-muted)]">
                        {locale.noResults}
                      </p>
                    ) : (
                      routeResults.map((route) => (
                        <button
                          key={route.routeId}
                          type="button"
                          onClick={() => handleSelectRoute(route.routeId)}
                          className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                            selectedRouteId === route.routeId
                              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                              : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                          }`}
                        >
                          <span className="text-lg font-semibold">
                            {route.route}
                          </span>
                          <span className="text-xs text-[color:var(--text-muted)]">
                            {getName(route.orig, language)} → {getName(route.dest, language)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}

              {(mode === "stop" || mode === "nearby") && (
                <div className="panel flex flex-col gap-4">
                  {mode === "stop" && (
                    <>
                      <div className="flex flex-col gap-2">
                        <span className="section-title">{locale.searchStop}</span>
                        <input
                          className="input"
                          value={stopQuery}
                          onChange={(event) => setStopQuery(event.target.value)}
                          placeholder={locale.stopSearchPlaceholder}
                        />
                      </div>
                      {dbStatus === "loading" && (
                        <p className="text-sm text-[color:var(--text-muted)]">
                          {locale.loading}
                        </p>
                      )}
                      {dbStatus === "error" && (
                        <p className="text-sm text-[color:var(--text-muted)]">
                          {locale.dataError}
                        </p>
                      )}
                      <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-2">
                        {stopResults.length === 0 ? (
                          <p className="text-sm text-[color:var(--text-muted)]">
                            {locale.noResults}
                          </p>
                        ) : (
                          stopResults.map((stop) => (
                            <button
                              key={stop.stopId}
                              type="button"
                              onClick={() => handleSelectStop(stop.stopId)}
                              className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                                selectedStopId === stop.stopId
                                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                                  : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                              }`}
                            >
                              <span className="text-sm font-semibold">
                                {getName(stop.name, language)}
                              </span>
                              <span className="text-xs text-[color:var(--text-muted)]">
                                {stop.stopId}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}

                  {mode === "nearby" && (
                    <>
                      <div className="flex flex-col gap-2">
                        <span className="section-title">{locale.locationTitle}</span>
                        <p className="text-xs text-[color:var(--text-faint)]">
                          {locale.locationHint}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={requestLocation}
                          className="btn btn-primary"
                        >
                          {locale.locationRequest}
                        </button>
                        {geoStatus === "loading" && (
                          <span className="text-xs text-[color:var(--text-faint)]">
                            {locale.loading}
                          </span>
                        )}
                      </div>
                      {geoError && (
                        <p className="text-sm text-[color:var(--text-muted)]">
                          {geoError}
                        </p>
                      )}
                      <div className="flex flex-col gap-2">
                        <span className="section-title">{locale.nearbyRadius}</span>
                        <div className="segment">
                          {radiusOptions.map((radius) => (
                            <button
                              key={radius}
                              type="button"
                              data-active={nearbyRadius === radius}
                              onClick={() => setNearbyRadius(radius)}
                            >
                              {formatDistance(radius, language)}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-2">
                        {nearbyStops.length === 0 ? (
                          <p className="text-sm text-[color:var(--text-muted)]">
                            {locale.noResults}
                          </p>
                        ) : (
                          nearbyStops.map((item) => (
                            <button
                              key={item.stop.stopId}
                              type="button"
                              onClick={() => handleSelectStop(item.stop.stopId)}
                              className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                                selectedStopId === item.stop.stopId
                                  ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                                  : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                              }`}
                            >
                              <span className="text-sm font-semibold">
                                {getName(item.stop.name, language)}
                              </span>
                              <span className="text-xs text-[color:var(--text-muted)]">
                                {formatDistance(item.distance, language)}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {mode === "route" && (
                <div className="panel flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="section-title">{locale.routeStops}</span>
                    <p className="text-xs text-[color:var(--text-faint)]">
                      {selectedRoute ? locale.selectStop : locale.selectRouteHint}
                    </p>
                  </div>
                  {selectedRoute && (
                    <div className="flex flex-wrap gap-2">
                      {availableCompanies.map((company) => (
                        <button
                          key={company}
                          type="button"
                          onClick={() => setSelectedCompany(company)}
                          className={`chip ${
                            selectedCompany === company
                              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                              : ""
                          }`}
                        >
                          {company}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex max-h-[320px] flex-col gap-2 overflow-y-auto pr-2">
                    {!selectedRoute ? (
                      <p className="text-sm text-[color:var(--text-muted)]">
                        {locale.selectRouteHint}
                      </p>
                    ) : stopsForRoute.length === 0 ? (
                      <p className="text-sm text-[color:var(--text-muted)]">
                        {locale.noResults}
                      </p>
                    ) : (
                      stopsForRoute.map((stop) => {
                        const stopDetails = etaDb?.stopList[stop.stopId];
                        return (
                          <button
                            key={`${stop.stopId}-${stop.seq}`}
                            type="button"
                            onClick={() => handleSelectStopSeq(stop.seq)}
                            className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                              selectedStopSeq === stop.seq
                                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                            }`}
                          >
                            <span className="text-sm font-semibold">
                              {stopDetails
                                ? getName(stopDetails.name, language)
                                : stop.stopId}
                            </span>
                            <span className="text-xs text-[color:var(--text-muted)]">
                              {stop.stopId}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-6">
              {(mode === "stop" || mode === "nearby") && (
                <div className="panel flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="section-title">{locale.routeList}</span>
                    <p className="text-xs text-[color:var(--text-faint)]">
                      {selectedStopId ? locale.chooseRoute : locale.selectStopHint}
                    </p>
                  </div>
                  {selectedStopDetails && (
                    <div className="flex flex-col gap-2">
                      <span className="text-sm font-semibold">
                        {getName(selectedStopDetails.name, language)}
                      </span>
                      <span className="text-xs text-[color:var(--text-muted)]">
                        {selectedStopId}
                      </span>
                    </div>
                  )}
                  <div className="flex flex-col gap-2">
                    <input
                      className="input"
                      value={routeFilter}
                      onChange={(event) => setRouteFilter(event.target.value)}
                      placeholder={locale.routeFilterPlaceholder}
                      disabled={!selectedStopId}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCompanyFilter("all")}
                        className={`chip ${
                          companyFilter === "all"
                            ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                            : ""
                        }`}
                      >
                        {locale.company} · ALL
                      </button>
                      {uniqueCompaniesForStop.map((company) => (
                        <button
                          key={company}
                          type="button"
                          onClick={() => setCompanyFilter(company)}
                          className={`chip ${
                            companyFilter === company
                              ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                              : ""
                          }`}
                        >
                          {company}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex max-h-[360px] flex-col gap-2 overflow-y-auto pr-2">
                    {!selectedStopId ? (
                      <p className="text-sm text-[color:var(--text-muted)]">
                        {locale.selectStopHint}
                      </p>
                    ) : filteredStopRoutes.length === 0 ? (
                      <p className="text-sm text-[color:var(--text-muted)]">
                        {locale.noResults}
                      </p>
                    ) : (
                      filteredStopRoutes.map((route) => {
                        const key = `${route.routeId}-${route.company}-${route.seq}`;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => handleSelectStopRoute(route)}
                            className={`flex flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition ${
                              selectedStopRouteKey === key
                                ? "border-[color:var(--accent)] bg-[color:var(--accent-soft)]"
                                : "border-[color:var(--border)] bg-[color:var(--surface-strong)]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-lg font-semibold">
                                {route.route}
                              </span>
                              <span className="chip">{route.company}</span>
                            </div>
                            <span className="text-xs text-[color:var(--text-muted)]">
                              {getName(route.orig, language)} → {getName(route.dest, language)}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              <div className="card flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="section-title">{locale.etas}</span>
                    {etaDetails?.stop && (
                      <span className="text-xs text-[color:var(--text-faint)]">
                        {getName(etaDetails.stop.name, language)}
                      </span>
                    )}
                  </div>
                  {etaDetails?.route && (
                    <div className="chip">
                      {etaDetails.route.route} · {etaDetails.company}
                    </div>
                  )}
                </div>
                {etaDetails?.route && etaDetails.stop && (
                  <div className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3">
                    <span className="text-sm font-semibold">
                      {getName(etaDetails.route.orig, language)} → {getName(etaDetails.route.dest, language)}
                    </span>
                    <span className="text-xs text-[color:var(--text-muted)]">
                      {etaDetails.stopId}
                    </span>
                  </div>
                )}

                {etaStatus === "loading" && (
                  <p className="text-sm text-[color:var(--text-muted)]">
                    {locale.loading}
                  </p>
                )}
                {etaStatus === "error" && (
                  <p className="text-sm text-[color:var(--text-muted)]">
                    {locale.etaError}
                  </p>
                )}
                {etaQuery === null && (
                  <p className="text-sm text-[color:var(--text-muted)]">
                    {mode === "route" ? locale.selectRouteHint : locale.selectStopHint}
                  </p>
                )}
                {etaQuery !== null && etaStatus !== "loading" && etas.length === 0 && (
                  <p className="text-sm text-[color:var(--text-muted)]">
                    {locale.etaUnavailable}
                  </p>
                )}
                <div className="flex flex-col gap-3">
                  {etas.map((eta, index) => (
                    <div
                      key={`${eta.co}-${eta.eta}-${index}`}
                      className="flex flex-col gap-2 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface-strong)] px-4 py-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-semibold">
                          {eta.eta || "--"}
                        </span>
                        <span className="chip">{eta.co}</span>
                      </div>
                      {eta.remark?.[language] && (
                        <span className="text-xs text-[color:var(--text-muted)]">
                          {eta.remark[language]}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                {etaUpdatedAt && (
                  <p className="text-xs text-[color:var(--text-faint)]">
                    {locale.updatedAt} {new Date(etaUpdatedAt).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
