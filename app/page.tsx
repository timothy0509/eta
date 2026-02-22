"use client";

import { useEffect, useMemo, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import Panel from "@/components/Panel";
import StatusBadge from "@/components/StatusBadge";
import StopPicker, { type StopPickerOption } from "@/components/StopPicker";
import { MTR_LINES, MTR_STATIONS_BY_LINE } from "@/data/mtr-lines";
import { TRANSLATIONS, type Language } from "@/i18n/translations";
import { formatEtaTime, type TimeMode } from "@/lib/time";
import type { BusCompany } from "@/lib/types";
import { useEtaStore } from "@/stores/etaStore";

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

function buildStopOptions(
  data: ReturnType<typeof useEtaStore.getState>["busStopData"],
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
  const {
    mode,
    language,
    timeMode,
    busQuery,
    busRoutes,
    busRouteStatus,
    selectedRoute,
    busStopData,
    stopPreference,
    selectedStopSeq,
    busEtas,
    busEtaStatus,
    mtrLine,
    mtrStation,
    mtrResponse,
    mtrStatus,
    lastBusFetchAt,
    lastMtrFetchAt,
    setMode,
    setLanguage,
    setTimeMode,
    setBusQuery,
    resetBusSelection,
    searchRoutes,
    selectRoute,
    loadStops,
    setStopPreference,
    setSelectedStopSeq,
    loadBusEtas,
    setMtrLine,
    setMtrStation,
    loadMtr,
  } = useEtaStore(
    useShallow((state) => ({
      mode: state.mode,
      language: state.language,
      timeMode: state.timeMode,
      busQuery: state.busQuery,
      busRoutes: state.busRoutes,
      busRouteStatus: state.busRouteStatus,
      selectedRoute: state.selectedRoute,
      busStopData: state.busStopData,
      stopPreference: state.stopPreference,
      selectedStopSeq: state.selectedStopSeq,
      busEtas: state.busEtas,
      busEtaStatus: state.busEtaStatus,
      mtrLine: state.mtrLine,
      mtrStation: state.mtrStation,
      mtrResponse: state.mtrResponse,
      mtrStatus: state.mtrStatus,
      lastBusFetchAt: state.lastBusFetchAt,
      lastMtrFetchAt: state.lastMtrFetchAt,
      setMode: state.setMode,
      setLanguage: state.setLanguage,
      setTimeMode: state.setTimeMode,
      setBusQuery: state.setBusQuery,
      resetBusSelection: state.resetBusSelection,
      searchRoutes: state.searchRoutes,
      selectRoute: state.selectRoute,
      loadStops: state.loadStops,
      setStopPreference: state.setStopPreference,
      setSelectedStopSeq: state.setSelectedStopSeq,
      loadBusEtas: state.loadBusEtas,
      setMtrLine: state.setMtrLine,
      setMtrStation: state.setMtrStation,
      loadMtr: state.loadMtr,
    })),
  );

  const labels = TRANSLATIONS[language];
  const previousLanguageRef = useRef(language);
  const stopOptions = useMemo(
    () => buildStopOptions(busStopData, language, stopPreference),
    [busStopData, language, stopPreference],
  );
  const selectedStop = useMemo(
    () => stopOptions.find((option) => option.seq === selectedStopSeq) ?? null,
    [stopOptions, selectedStopSeq],
  );

  const availableStations = useMemo(
    () => (mtrLine ? MTR_STATIONS_BY_LINE[mtrLine] ?? [] : []),
    [mtrLine],
  );

  const busStale =
    lastBusFetchAt && Date.now() - lastBusFetchAt > REFRESH_MS * 2;
  const mtrStale =
    lastMtrFetchAt && Date.now() - lastMtrFetchAt > REFRESH_MS * 2;

  useEffect(() => {
    if (!selectedRoute) return;
    void loadStops(selectedRoute.id);
  }, [selectedRoute, loadStops, language]);

  useEffect(() => {
    if (previousLanguageRef.current === language) return;
    previousLanguageRef.current = language;
    if (!busQuery.trim()) return;
    void searchRoutes(busQuery);
  }, [language, busQuery, searchRoutes]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (selectedRoute && selectedStopSeq !== null) {
      void loadBusEtas(selectedRoute.id, selectedStopSeq);
      timer = setInterval(
        () => loadBusEtas(selectedRoute.id, selectedStopSeq),
        REFRESH_MS,
      );
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [selectedRoute, selectedStopSeq, loadBusEtas, language]);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (mtrLine && mtrStation) {
      void loadMtr(mtrLine, mtrStation);
      timer = setInterval(() => loadMtr(mtrLine, mtrStation), REFRESH_MS);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [mtrLine, mtrStation, loadMtr, language]);

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
                    className={`ui-press rounded-full px-4 py-2 font-semibold transition ${
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
                    onClick={() => setTimeMode(option.key as TimeMode)}
                    className={`ui-press rounded-full px-4 py-2 font-semibold transition ${
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

        <div className="mt-10 grid gap-6 lg:grid-cols-[420px_1fr]">
          <div className="space-y-6 lg:sticky lg:top-6">
            <Panel className="bg-white/80">
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
                      className={`ui-press rounded-full px-4 py-2 text-sm font-medium transition ${
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
            </Panel>

            {mode === "bus" ? (
              <Panel>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    resetBusSelection();
                    void searchRoutes(busQuery);
                  }}
                  className="space-y-3"
                >
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
                      className="ui-press rounded-2xl bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
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
                  <div className="grid gap-3">
                    {busRoutes.map((route) => (
                      <button
                        key={route.id}
                        type="button"
                        onClick={() => selectRoute(route)}
                        className={`ui-lift rounded-2xl border px-4 py-3 text-left transition ${
                          selectedRoute?.id === route.id
                            ? "border-[var(--accent)] bg-white"
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
                  <div className="mt-6 space-y-4 rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
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
                              className={`ui-press rounded-full px-3 py-1 font-semibold transition ${
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
                              className={`ui-press rounded-full px-3 py-1 font-semibold transition ${
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
                      onChange={(option) => setSelectedStopSeq(option.seq)}
                      disabled={!busStopData}
                    />
                  </div>
                )}
              </Panel>
            ) : (
              <Panel>
                <div className="grid gap-4">
                  <label className="text-sm font-medium text-[var(--foreground)]">
                    {labels.lineLabel}
                    <select
                      value={mtrLine}
                      onChange={(event) => setMtrLine(event.target.value)}
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
              </Panel>
            )}
          </div>

          <Panel className="min-h-[520px]">
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
                <StatusBadge
                  label={mtrResponse.isDelay ? labels.delay : labels.onTime}
                  tone={mtrResponse.isDelay ? "warning" : "info"}
                />
              )}
            </div>

            {mode === "bus" ? (
              <div className="mt-6 space-y-4" aria-live="polite">
                {!selectedRoute && (
                  <p className="text-sm text-[var(--muted)]">
                    {labels.searchHint}
                  </p>
                )}
                {selectedRoute && selectedStopSeq === null && (
                  <p className="text-sm text-[var(--muted)]">
                    {labels.stopPlaceholder}
                  </p>
                )}
                {selectedRoute && selectedStopSeq !== null && (
                  <div className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[var(--foreground)]">
                        {labels.upcoming}
                      </p>
                      {busEtaStatus === "loading" && (
                        <span className="text-xs text-[var(--muted)] ui-pulse">
                          {labels.updating}
                        </span>
                      )}
                    </div>
                    {busStale && (
                      <p className="mt-2 text-xs text-[var(--accent-warm)]">
                        {labels.staleData}
                      </p>
                    )}
                    <div className="mt-3 space-y-2">
                      {busEtas.length === 0 && busEtaStatus === "idle" && (
                        <p className="text-sm text-[var(--muted)]">
                          {labels.noEta}
                        </p>
                      )}
                      {busEtas.map((eta, index) => (
                        <div
                          key={`${eta.time}-${index}`}
                          className="ui-animate-in flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                        >
                          <div>
                            <p className="text-lg font-semibold text-[var(--foreground)] tabular-nums">
                              {formatEtaTime(
                                eta.time,
                                timeMode,
                                {
                                  due: labels.due,
                                  minutes: labels.minutes,
                                  hours: labels.hours,
                                },
                                language === "tc" ? "zh-HK" : "en-HK",
                              )}
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
              <div className="mt-6 space-y-4" aria-live="polite">
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
                  <p className="text-sm text-[var(--muted)] ui-pulse">
                    {labels.loadingMtr}
                  </p>
                )}
                {mtrStale && (
                  <p className="text-xs text-[var(--accent-warm)]">
                    {labels.staleData}
                  </p>
                )}
                {mtrResponse?.lastUpdated && (
                  <p className="text-xs text-[var(--muted)]">
                    {labels.lastUpdated}: {mtrResponse.lastUpdated}
                  </p>
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
                        className="rounded-2xl border border-[var(--line)] bg-[var(--surface-2)] p-4"
                      >
                        <div className="flex items-center justify-between text-xs uppercase tracking-[0.3em] text-[var(--muted)]">
                          <span>{direction.label}</span>
                          <span>{direction.entries.length}</span>
                        </div>
                        <div className="mt-3 space-y-2">
                          {direction.entries.map((entry, index) => (
                            <div
                              key={`${entry.time}-${index}`}
                              className="ui-animate-in flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm"
                            >
                              <div>
                                <p className="text-lg font-semibold text-[var(--foreground)] tabular-nums">
                                  {formatEtaTime(
                                    entry.time,
                                    timeMode,
                                    {
                                      due: labels.due,
                                      minutes: labels.minutes,
                                      hours: labels.hours,
                                    },
                                    language === "tc" ? "zh-HK" : "en-HK",
                                  )}
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
          </Panel>
        </div>
      </div>
    </div>
  );
}
