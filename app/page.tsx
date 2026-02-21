"use client";

import { useEffect, useMemo, useState } from "react";
import StopPicker, { type StopPickerOption } from "@/components/StopPicker";
import { MTR_LINES, MTR_STATIONS_BY_LINE } from "@/data/mtr-lines";

type BusCompany =
  | "kmb"
  | "ctb"
  | "nlb"
  | "gmb"
  | "lrtfeeder"
  | "sunferry"
  | "hkkf"
  | "fortuneferry";

type BusRouteSummary = {
  id: string;
  route: string;
  orig: string;
  dest: string;
  companies: BusCompany[];
  serviceType: string;
};

type BusStopOption = {
  seq: number;
  stopIds: Partial<Record<BusCompany, string>>;
  names: Partial<Record<BusCompany, string>>;
};

type BusStopData = {
  companies: BusCompany[];
  isJoint: boolean;
  stops: BusStopOption[];
};

type BusEta = {
  time: string;
  remark: string;
  company: BusCompany;
  destination: string;
};

type MtrEta = {
  time: string;
  platform: string;
  destination: string;
  destinationCode: string;
  sequence: string;
  timetype?: string;
  route?: string;
};

type MtrResponse = {
  status: "ok" | "empty" | "error";
  message: string;
  isDelay: boolean | null;
  lastUpdated: string | null;
  line?: { code: string; name: string };
  station?: { code: string; name: string };
  up: MtrEta[];
  down: MtrEta[];
};

const BUS_COMPANY_LABELS: Record<BusCompany, string> = {
  kmb: "KMB",
  ctb: "Citybus",
  nlb: "NLB",
  gmb: "GMB",
  lrtfeeder: "LRT Feeder",
  sunferry: "Sun Ferry",
  hkkf: "HKKF",
  fortuneferry: "Fortune Ferry",
};

const REFRESH_MS = 25000;

const COPY = {
  en: {
    headingTag: "Hong Kong Transit",
    headingTitle: "ETA Control Room",
    headingBody:
      "Plan your next ride with real-time bus and MTR heavy rail arrival data. Select a mode, then drill down to route and stop for the freshest ETA signals across the city.",
    liveUpdate: "Live updates every 25 seconds",
    modeTitle: "Transit mode",
    modeSubtitle: "Choose your feed",
    busMode: "Bus & Ferry",
    mtrMode: "MTR Heavy Rail",
    routeLabel: "Route number",
    routePlaceholder: "e.g. 1, 101, A21",
    search: "Search",
    matchingRoutes: "Matching routes",
    searchHint: "Search a route number to begin.",
    searchError: "Unable to search routes right now.",
    loadingRoutes: "Loading routes...",
    stopPreference: "Stop name preference",
    stopPreferenceKmb: "KMB names",
    stopPreferenceCtb: "Citybus names",
    stopLabel: "Stop",
    stopPlaceholder: "Select a stop",
    upcoming: "Upcoming arrivals",
    updating: "Updating...",
    noEta: "No ETA available yet.",
    etaError: "Service unavailable. Try again shortly.",
    destinationMissing: "Destination unavailable",
    lineLabel: "Line",
    stationLabel: "Station",
    selectLine: "Select line",
    selectStation: "Select station",
    heavyRail: "Heavy Rail ETA",
    delay: "Delay reported",
    onTime: "On time",
    loadingMtr: "Loading ETA...",
    chooseLineStation: "Choose line and station",
    noTrains: "No trains listed.",
    viewTitle: "Live ETA",
    viewSubtitle: "Monitor arrivals in real time",
    countdown: "Countdown",
    exact: "Exact time",
    due: "Due",
    minutes: "min",
    hours: "h",
    language: "Language",
    timeMode: "Time display",
    operator: "Operator",
    stopSearch: "Search stops",
    noStops: "No stops found.",
  },
  tc: {
    headingTag: "香港公共交通",
    headingTitle: "到站時間中心",
    headingBody:
      "即時巴士及港鐵重鐵到站資訊。選擇模式後，再選路線及車站以獲得最新到站時間。",
    liveUpdate: "每 25 秒更新",
    modeTitle: "交通模式",
    modeSubtitle: "選擇訊號",
    busMode: "巴士及渡輪",
    mtrMode: "港鐵重鐵",
    routeLabel: "路線編號",
    routePlaceholder: "例如 1、101、A21",
    search: "搜尋",
    matchingRoutes: "匹配路線",
    searchHint: "請先輸入路線編號。",
    searchError: "暫時無法搜尋路線。",
    loadingRoutes: "載入路線...",
    stopPreference: "站名偏好",
    stopPreferenceKmb: "九巴站名",
    stopPreferenceCtb: "城巴站名",
    stopLabel: "車站",
    stopPlaceholder: "選擇車站",
    upcoming: "即將到站",
    updating: "更新中...",
    noEta: "暫無到站時間。",
    etaError: "服務暫時不可用，請稍後再試。",
    destinationMissing: "未有目的地",
    lineLabel: "路線",
    stationLabel: "車站",
    selectLine: "選擇路線",
    selectStation: "選擇車站",
    heavyRail: "港鐵重鐵到站",
    delay: "延誤",
    onTime: "正常",
    loadingMtr: "載入到站資訊...",
    chooseLineStation: "選擇路線及車站",
    noTrains: "暫無班次",
    viewTitle: "即時到站",
    viewSubtitle: "實時監察到站情況",
    countdown: "倒數",
    exact: "準確時間",
    due: "即將到站",
    minutes: "分鐘",
    hours: "小時",
    language: "語言",
    timeMode: "時間顯示",
    operator: "營辦商",
    stopSearch: "搜尋車站",
    noStops: "找不到車站。",
  },
} as const;

type Language = keyof typeof COPY;
type TimeMode = "countdown" | "exact";

function parseTime(value: string) {
  if (!value || value === "-") return null;
  if (value.includes("T")) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/);
  if (match) {
    const parsed = new Date(`${match[1]}T${match[2]}+08:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatEtaTime(value: string, mode: TimeMode, language: Language) {
  const labels = COPY[language];
  const parsed = parseTime(value);
  if (!parsed) return value || "-";

  if (mode === "exact") {
    return new Intl.DateTimeFormat(language === "tc" ? "zh-HK" : "en-HK", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(parsed);
  }

  const diffMs = parsed.getTime() - Date.now();
  if (diffMs <= 0) return labels.due;
  const totalMinutes = Math.max(1, Math.round(diffMs / 60000));
  if (totalMinutes < 60) return `${totalMinutes} ${labels.minutes}`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes
    ? `${hours}${labels.hours} ${minutes} ${labels.minutes}`
    : `${hours}${labels.hours}`;
}

function buildStopOptions(
  data: BusStopData | null,
  language: Language,
  preference: BusCompany | null,
): StopPickerOption[] {
  if (!data) return [];

  return data.stops.map((stop) => {
    const primaryCompany =
      preference && stop.names[preference]
        ? preference
        : data.companies.find((company) => stop.names[company]) ??
          data.companies[0];
    const primaryName = primaryCompany ? stop.names[primaryCompany] : undefined;
    const altCompany =
      data.isJoint && primaryCompany === "kmb" ? "ctb" : "kmb";
    const altName = data.isJoint ? stop.names[altCompany] : undefined;
    const fallbackId = primaryCompany ? stop.stopIds[primaryCompany] : undefined;
    const fallbackLabel = primaryName ?? fallbackId ?? `${stop.seq + 1}`;
    const label = `${stop.seq + 1}. ${fallbackLabel}`;
    const sublabel =
      data.isJoint && altName
        ? `${BUS_COMPANY_LABELS[altCompany]} · ${altName}`
        : undefined;

    return {
      id: String(stop.seq),
      label,
      sublabel,
      seq: stop.seq,
    };
  });
}

export default function Home() {
  const [mode, setMode] = useState<"bus" | "mtr">("bus");
  const [language, setLanguage] = useState<Language>("en");
  const [timeMode, setTimeMode] = useState<TimeMode>("countdown");

  const labels = COPY[language];

  const [busQuery, setBusQuery] = useState("");
  const [busRoutes, setBusRoutes] = useState<BusRouteSummary[]>([]);
  const [busRouteStatus, setBusRouteStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [selectedRoute, setSelectedRoute] = useState<BusRouteSummary | null>(
    null,
  );
  const [busStopData, setBusStopData] = useState<BusStopData | null>(null);
  const [stopPreference, setStopPreference] = useState<BusCompany | null>(null);
  const [selectedStop, setSelectedStop] = useState<StopPickerOption | null>(null);
  const [busEtas, setBusEtas] = useState<BusEta[]>([]);
  const [busEtaStatus, setBusEtaStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [busEtaMessage, setBusEtaMessage] = useState("");

  const [mtrLine, setMtrLine] = useState("");
  const [mtrStation, setMtrStation] = useState("");
  const [mtrResponse, setMtrResponse] = useState<MtrResponse | null>(null);
  const [mtrStatus, setMtrStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");

  const availableStations = useMemo(
    () => (mtrLine ? MTR_STATIONS_BY_LINE[mtrLine] ?? [] : []),
    [mtrLine],
  );

  const stopOptions = useMemo(
    () => buildStopOptions(busStopData, language, stopPreference),
    [busStopData, language, stopPreference],
  );

  useEffect(() => {
    if (!selectedStop) return;
    const next = stopOptions.find((option) => option.seq === selectedStop.seq);
    if (next && next.label !== selectedStop.label) {
      setSelectedStop(next);
    }
  }, [stopOptions, selectedStop]);

  async function fetchRoutes(query: string) {
    const response = await fetch(
      `/api/bus?action=search&query=${encodeURIComponent(query)}&lang=${language}`,
    );
    const payload = await response.json();
    if (!response.ok || payload.status !== "ok") {
      throw new Error(payload.message ?? "Unable to search routes.");
    }
    return payload.routes as BusRouteSummary[];
  }

  async function handleBusSearch(event: React.FormEvent) {
    event.preventDefault();
    const query = busQuery.trim();
    if (!query) return;
    setBusRouteStatus("loading");
    setBusRoutes([]);
    setSelectedRoute(null);
    setBusStopData(null);
    setSelectedStop(null);
    setBusEtas([]);
    setBusEtaMessage("");

    try {
      const routes = await fetchRoutes(query);
      setBusRoutes(routes ?? []);
      setBusRouteStatus("idle");
    } catch (error) {
      setBusRouteStatus("error");
    }
  }

  useEffect(() => {
    async function loadStops() {
      if (!selectedRoute) return;
      setBusStopData(null);
      setSelectedStop(null);
      setBusEtas([]);
      setBusEtaMessage("");
      setBusEtaStatus("idle");

      const response = await fetch(
        `/api/bus?action=stops&routeId=${encodeURIComponent(
          selectedRoute.id,
        )}&lang=${language}`,
      );
      const payload = await response.json();
      if (!response.ok || payload.status !== "ok") {
        return;
      }

      setBusStopData({
        companies: payload.companies ?? [],
        isJoint: payload.isJoint ?? false,
        stops: payload.stops ?? [],
      });

      if (payload.isJoint) {
        setStopPreference("kmb");
      } else if (payload.companies?.length) {
        setStopPreference(payload.companies[0]);
      } else {
        setStopPreference(null);
      }
    }

    void loadStops();
  }, [selectedRoute, language]);

  useEffect(() => {
    if (!busQuery) return;
    if (busRoutes.length === 0 && busRouteStatus === "idle") return;
    void (async () => {
      try {
        const routes = await fetchRoutes(busQuery.trim());
        setBusRoutes(routes ?? []);
      } catch (error) {
        setBusRouteStatus("error");
      }
    })();
  }, [language]);

  useEffect(() => {
    let active = true;
    let interval: NodeJS.Timeout | null = null;

    async function loadEtas() {
      if (!selectedRoute || !selectedStop) return;
      setBusEtaStatus("loading");
      try {
        const response = await fetch(
          `/api/bus?action=eta&routeId=${encodeURIComponent(
            selectedRoute.id,
          )}&seq=${selectedStop.seq}&lang=${language}`,
        );
        const payload = await response.json();
        if (!active) return;
        if (!response.ok || payload.status !== "ok") {
          throw new Error(payload.message ?? "Unable to load ETA.");
        }
        setBusEtas(payload.etas ?? []);
        setBusEtaMessage(payload.etas?.length ? "" : labels.noEta);
        setBusEtaStatus("idle");
      } catch (error) {
        if (!active) return;
        setBusEtaStatus("error");
        setBusEtaMessage(labels.etaError);
      }
    }

    if (selectedRoute && selectedStop) {
      void loadEtas();
      interval = setInterval(loadEtas, REFRESH_MS);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [selectedRoute, selectedStop, language, labels]);

  useEffect(() => {
    let active = true;
    let interval: NodeJS.Timeout | null = null;

    async function loadMtr() {
      if (!mtrLine || !mtrStation) return;
      setMtrStatus("loading");
      try {
        const response = await fetch(
          `/api/mtr?line=${encodeURIComponent(
            mtrLine,
          )}&station=${encodeURIComponent(mtrStation)}&lang=${language}`,
        );
        const payload = (await response.json()) as MtrResponse;
        if (!active) return;
        setMtrResponse(payload);
        setMtrStatus(response.ok ? "idle" : "error");
      } catch (error) {
        if (!active) return;
        setMtrStatus("error");
      }
    }

    if (mtrLine && mtrStation) {
      void loadMtr();
      interval = setInterval(loadMtr, REFRESH_MS);
    }

    return () => {
      active = false;
      if (interval) clearInterval(interval);
    };
  }, [mtrLine, mtrStation, language]);

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10">
        <header className="flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">
                {labels.headingTag}
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] sm:text-4xl">
                {labels.headingTitle}
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-full border border-[var(--line)] bg-white/80 p-1 text-xs">
                {([
                  { key: "en", label: "EN" },
                  { key: "tc", label: "中文" },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setLanguage(option.key)}
                    className={`rounded-full px-4 py-2 font-semibold transition ${
                      language === option.key
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="rounded-full border border-[var(--line)] bg-white/80 p-1 text-xs">
                {([
                  { key: "countdown", label: labels.countdown },
                  { key: "exact", label: labels.exact },
                ] as const).map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setTimeMode(option.key)}
                    className={`rounded-full px-4 py-2 font-semibold transition ${
                      timeMode === option.key
                        ? "bg-[var(--accent)] text-white"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="max-w-3xl text-base text-[var(--muted)]">
            {labels.headingBody}
          </p>
          <div className="inline-flex items-center gap-3 rounded-full border border-[var(--line)] bg-white/70 px-4 py-2 text-xs font-medium text-[var(--muted)] shadow-sm">
            <span className="h-2 w-2 rounded-full bg-[var(--accent-warm)]" />
            {labels.liveUpdate}
          </div>
        </header>

        <div className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.4fr]">
          <section className="space-y-6">
            <div className="rounded-3xl border border-[var(--line)] bg-white/80 p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                {labels.modeTitle}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  {labels.modeSubtitle}
                </h2>
                <div className="flex rounded-full border border-[var(--line)] bg-white/80 p-1">
                  {([
                    { key: "bus", label: labels.busMode },
                    { key: "mtr", label: labels.mtrMode },
                  ] as const).map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setMode(option.key)}
                      className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                        mode === option.key
                          ? "bg-[var(--accent)] text-white shadow"
                          : "text-[var(--muted)] hover:text-[var(--foreground)]"
                      }`}
                      aria-pressed={mode === option.key}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {mode === "bus" ? (
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(23,20,14,0.08)]">
                <form onSubmit={handleBusSearch} className="space-y-3">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    {labels.routeLabel}
                  </label>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <input
                      value={busQuery}
                      onChange={(event) => setBusQuery(event.target.value)}
                      placeholder={labels.routePlaceholder}
                      className="w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm shadow-sm focus:border-[var(--accent)] focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
                    >
                      {labels.search}
                    </button>
                  </div>
                  {busRouteStatus === "error" && (
                    <p className="text-sm text-[var(--accent-warm)]">
                      {labels.searchError}
                    </p>
                  )}
                </form>

                <div className="mt-6 space-y-3">
                  <p className="text-sm font-medium text-[var(--foreground)]">
                    {labels.matchingRoutes}
                  </p>
                  {busRouteStatus === "loading" && (
                    <p className="text-sm text-[var(--muted)]">
                      {labels.loadingRoutes}
                    </p>
                  )}
                  {busRoutes.length === 0 && busRouteStatus === "idle" && (
                    <p className="text-sm text-[var(--muted)]">
                      {labels.searchHint}
                    </p>
                  )}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {busRoutes.map((route) => (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => {
                          setSelectedRoute(route);
                          setBusStopData(null);
                          setSelectedStop(null);
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left transition ${
                          selectedRoute?.id === route.id
                            ? "border-[var(--accent)] bg-white shadow"
                            : "border-[var(--line)] bg-white/70 hover:border-[var(--accent)]"
                        }`}
                      >
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {route.route}
                        </p>
                        <p className="text-xs text-[var(--muted)]">
                          {route.orig} → {route.dest}
                        </p>
                        <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                          {route.companies
                            .map((company) => BUS_COMPANY_LABELS[company])
                            .join(" · ")}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {selectedRoute && (
                  <div className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-white/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                          {selectedRoute.route}
                        </p>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {selectedRoute.orig} → {selectedRoute.dest}
                        </p>
                      </div>
                      {busStopData?.isJoint && (
                        <div className="flex flex-col gap-2 text-xs text-[var(--muted)]">
                          <span className="uppercase tracking-[0.2em]">
                            {labels.stopPreference}
                          </span>
                          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] bg-white/80 p-1">
                            <button
                              type="button"
                              onClick={() => setStopPreference("kmb")}
                              className={`rounded-full px-3 py-1 font-semibold transition ${
                                stopPreference === "kmb"
                                  ? "bg-[var(--accent)] text-white"
                                  : "text-[var(--muted)]"
                              }`}
                            >
                              {labels.stopPreferenceKmb}
                            </button>
                            <button
                              type="button"
                              onClick={() => setStopPreference("ctb")}
                              className={`rounded-full px-3 py-1 font-semibold transition ${
                                stopPreference === "ctb"
                                  ? "bg-[var(--accent)] text-white"
                                  : "text-[var(--muted)]"
                              }`}
                            >
                              {labels.stopPreferenceCtb}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <StopPicker
                      label={labels.stopLabel}
                      placeholder={labels.stopPlaceholder}
                      searchPlaceholder={labels.stopSearch}
                      emptyLabel={labels.noStops}
                      options={stopOptions}
                      value={selectedStop}
                      onChange={setSelectedStop}
                      disabled={!busStopData}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-3xl border border-[var(--line)] bg-[var(--card)] p-6 shadow-[0_20px_60px_rgba(23,20,14,0.08)]">
                <div className="grid gap-4">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    {labels.lineLabel}
                    <select
                      value={mtrLine}
                      onChange={(event) => {
                        setMtrLine(event.target.value);
                        setMtrStation("");
                        setMtrResponse(null);
                      }}
                      className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                    >
                      <option value="">{labels.selectLine}</option>
                      {MTR_LINES.map((line) => (
                        <option key={line.code} value={line.code}>
                          {line.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    {labels.stationLabel}
                    <select
                      value={mtrStation}
                      onChange={(event) => setMtrStation(event.target.value)}
                      className="mt-2 w-full rounded-2xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                      disabled={!mtrLine}
                    >
                      <option value="">{labels.selectStation}</option>
                      {availableStations.map((station) => (
                        <option key={station.code} value={station.code}>
                          {station.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-[var(--line)] bg-white/80 p-6 shadow-[0_20px_60px_rgba(23,20,14,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                  {labels.viewTitle}
                </p>
                <h2 className="text-2xl font-semibold text-[var(--foreground)]">
                  {labels.viewSubtitle}
                </h2>
              </div>
              {mode === "mtr" && mtrResponse?.isDelay !== null && (
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    mtrResponse.isDelay
                      ? "bg-[var(--accent-warm)] text-white"
                      : "bg-[var(--accent)] text-white"
                  }`}
                >
                  {mtrResponse.isDelay ? labels.delay : labels.onTime}
                </span>
              )}
            </div>

            {mode === "bus" ? (
              <div className="mt-6 space-y-4">
                {!selectedRoute && (
                  <p className="text-sm text-[var(--muted)]">
                    {labels.searchHint}
                  </p>
                )}
                {selectedRoute && !selectedStop && (
                  <p className="text-sm text-[var(--muted)]">
                    {labels.stopPlaceholder}
                  </p>
                )}
                {selectedRoute && selectedStop && (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {labels.upcoming}
                      </p>
                      {busEtaStatus === "loading" && (
                        <span className="text-xs text-[var(--muted)]">
                          {labels.updating}
                        </span>
                      )}
                    </div>
                    {busEtaMessage && (
                      <p className="mt-2 text-sm text-[var(--muted)]">
                        {busEtaMessage}
                      </p>
                    )}
                    <div className="mt-3 space-y-2">
                      {busEtas.map((eta, index) => (
                        <div
                          key={`${eta.time}-${index}`}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="text-lg font-semibold text-[var(--foreground)]">
                              {formatEtaTime(eta.time, timeMode, language)}
                            </p>
                            <p className="text-xs text-[var(--muted)]">
                              {eta.destination || labels.destinationMissing}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1 text-xs text-[var(--muted)]">
                            <span className="rounded-full border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[10px] uppercase tracking-[0.2em]">
                              {BUS_COMPANY_LABELS[eta.company]}
                            </span>
                            <span>{eta.remark || ""}</span>
                          </div>
                        </div>
                      ))}
                      {busEtaStatus === "error" && (
                        <p className="text-sm text-[var(--accent-warm)]">
                          {labels.etaError}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mt-6 space-y-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                    {labels.heavyRail}
                  </p>
                  <p className="text-lg font-semibold text-[var(--foreground)]">
                    {mtrResponse?.line?.name && mtrResponse?.station?.name
                      ? `${mtrResponse.line.name} · ${mtrResponse.station.name}`
                      : labels.chooseLineStation}
                  </p>
                </div>
                {mtrStatus === "loading" && (
                  <p className="text-sm text-[var(--muted)]">{labels.loadingMtr}</p>
                )}
                {mtrResponse?.message && mtrResponse.status !== "ok" && (
                  <p className="text-sm text-[var(--accent-warm)]">
                    {mtrResponse.message}
                  </p>
                )}
                {mtrResponse?.status === "empty" && (
                  <p className="text-sm text-[var(--muted)]">
                    {mtrResponse.message}
                  </p>
                )}
                {mtrResponse?.status === "ok" && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[
                      { label: "UP", entries: mtrResponse.up },
                      { label: "DOWN", entries: mtrResponse.down },
                    ].map((direction) => (
                      <div
                        key={direction.label}
                        className="rounded-2xl border border-[var(--line)] bg-[var(--card)] p-4"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                          <span>{direction.label}</span>
                          <span>{direction.entries.length}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {direction.entries.map((entry, index) => (
                            <div
                              key={`${entry.time}-${index}`}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                            >
                              <div>
                                <p className="text-lg font-semibold text-[var(--foreground)]">
                                  {formatEtaTime(entry.time, timeMode, language)}
                                </p>
                                <p className="text-xs text-[var(--muted)]">
                                  {entry.destination || entry.destinationCode}
                                </p>
                              </div>
                              <div className="text-xs text-[var(--muted)]">
                                Plat {entry.platform || "-"}
                              </div>
                            </div>
                          ))}
                          {direction.entries.length === 0 && (
                            <p className="text-sm text-[var(--muted)]">
                              {labels.noTrains}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
