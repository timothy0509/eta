"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { AutoRefreshMenu } from "@/components/eta/auto-refresh";
import { FavoritesAndRecents } from "@/components/eta/favorites";
import { LanguageToggle } from "@/components/eta/language-toggle";
import { ModeTabs } from "@/components/eta/mode-tabs";
import { KmbPane, type KmbPaneState } from "@/components/eta/panes/kmb-pane";
import { MtrPane, type MtrPaneState } from "@/components/eta/panes/mtr-pane";
import { LrtPane, type LrtPaneState } from "@/components/eta/panes/lrt-pane";
import { KmbResults } from "@/components/eta/results-kmb";
import { MtrResults } from "@/components/eta/results-mtr";
import { LrtResults } from "@/components/eta/results-lrt";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LRT_STATIONS } from "@/lib/data/lrt-stations";
import { MTR_STATIONS } from "@/lib/data/mtr-stations";
import type { KmbStopSearchItem, LrtStationSearchItem, MtrStationSearchItem } from "@/lib/eta/types";
import { isLanguageSupported } from "@/lib/eta/types";
import { useAutoRefresh } from "@/lib/eta/use-auto-refresh";
import { useAppStore, type FavoritesItem } from "@/lib/store";

export default function Home() {
  const mode = useAppStore((s) => s.mode);
  const setMode = useAppStore((s) => s.setMode);

  const lang = useAppStore((s) => s.lang);
  const setLang = useAppStore((s) => s.setLang);

  const routeFilterMode = useAppStore((s) => s.routeFilterMode);
  const setRouteFilterMode = useAppStore((s) => s.setRouteFilterMode);

  const autoRefreshSeconds = useAppStore((s) => s.autoRefreshSeconds);
  const setAutoRefreshSeconds = useAppStore((s) => s.setAutoRefreshSeconds);

  const [savedOpen, setSavedOpen] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);

  const addFavorite = useAppStore((s) => s.addFavorite);
  const addRecent = useAppStore((s) => s.addRecent);

  const { theme, setTheme, resolvedTheme } = useTheme();
  const [themeMounted, setThemeMounted] = React.useState(false);

  const [kmbStops, setKmbStops] = React.useState<KmbStopSearchItem[]>([]);
  const [kmbPaneState, setKmbPaneState] = React.useState<KmbPaneState | null>(null);
  const [mtrPaneState, setMtrPaneState] = React.useState<MtrPaneState | null>(null);
  const [lrtPaneState, setLrtPaneState] = React.useState<LrtPaneState | null>(null);
  const [selectedItem, setSelectedItem] = React.useState<FavoritesItem | null>(null);

  const canFavoriteRef = React.useRef(false);

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

  const lrtStations: LrtStationSearchItem[] = React.useMemo(
    () =>
      LRT_STATIONS.map((s) => ({
        stationId: s.stationId,
        nameEn: s.nameEn,
        nameZh: s.nameZh,
      })),
    []
  );

  React.useEffect(() => {
    setThemeMounted(true);
  }, []);

  React.useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");

    const onChange = () => {
      setIsDesktop(media.matches);
    };

    onChange();
    media.addEventListener("change", onChange);
    return () => {
      media.removeEventListener("change", onChange);
    };
  }, []);

  React.useEffect(() => {
    if (isLanguageSupported(mode, lang)) return;
    setLang("tc");
  }, [lang, mode, setLang]);

  const refreshRef = React.useRef<(() => Promise<void>) | null>(null);
  const inFlightRefreshRef = React.useRef(false);

  const onRegisterRefresh = React.useCallback((refresh: () => Promise<void>) => {
    refreshRef.current = refresh;
  }, []);

  useAutoRefresh(autoRefreshSeconds * 1000, () => {
    if (!refreshRef.current) return;
    if (inFlightRefreshRef.current) return;

    inFlightRefreshRef.current = true;
    refreshRef.current()
      .catch(() => {
        // ignore auto-refresh errors
      })
      .finally(() => {
        inFlightRefreshRef.current = false;
      });
  });

  const onSelectFromLists = (item: FavoritesItem) => {
    setSelectedItem(item);
    setMode(item.mode);
    setSavedOpen(false);
  };

  const heading =
    mode === "kmb"
      ? lang === "en"
        ? "KMB bus ETAs"
        : lang === "sc"
          ? "九巴到站预报"
          : "九巴到站預報"
      : mode === "mtr"
        ? lang === "en"
          ? "MTR Next Train"
          : lang === "sc"
            ? "港铁下班车"
            : "港鐵下班車"
        : lang === "en"
          ? "Light Rail"
          : "輕鐵";

  const t = {
    desc:
      lang === "en"
        ? "Clean, fast ETAs for Hong Kong transit."
        : lang === "sc"
          ? "简洁、快速的香港交通到站预报。"
          : "簡潔、快速的香港交通到站預報。",
    theme: lang === "en" ? "Theme" : lang === "sc" ? "主题" : "主題",
    searchPin:
      lang === "en"
        ? "Search and pin your go-to stops."
        : lang === "sc"
          ? "搜索并固定您的常用车站。"
          : "搜索並固定您的常用車站。",
    kmbTitle: lang === "en" ? "KMB ETAs" : lang === "sc" ? "九巴到站预报" : "九巴到站預報",
    mtrTitle: lang === "en" ? "MTR" : lang === "sc" ? "港铁" : "港鐵",
    lrtTitle: lang === "en" ? "Light Rail" : "輕鐵",
  };

  return (
    <div className="relative min-h-dvh bg-gradient-to-b from-background via-background to-muted/30">
      <div className="pointer-events-none absolute inset-0 opacity-40 [background:radial-gradient(80%_40%_at_50%_0%,hsl(var(--primary)/0.18),transparent_70%)]" />

      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-2">
            <div className="ui-animate-in flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">TimoETA</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t.desc}</p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setSavedOpen(!savedOpen)}
                >
                  {lang === "en" ? "Saved" : lang === "sc" ? "\u5df2\u50a8\u5b58" : "\u5df2\u5132\u5b58"}
                </Button>
                <AutoRefreshMenu lang={lang} valueSeconds={autoRefreshSeconds} onChange={setAutoRefreshSeconds} />
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
                  {t.theme}
                </Button>
              </div>
            </div>


          <Sheet open={savedOpen} onOpenChange={setSavedOpen}>
            {isDesktop ? (
              <SheetContent side="right">
                <SheetHeader>
                  <SheetTitle>
                    {lang === "en" ? "Saved" : lang === "sc" ? "\u5df2\u50a8\u5b58" : "\u5df2\u5132\u5b58"}
                  </SheetTitle>
                </SheetHeader>
                <SheetBody>
                  <FavoritesAndRecents lang={lang} kmbStops={kmbStops} onSelect={onSelectFromLists} />
                </SheetBody>
              </SheetContent>
            ) : (
              <SheetContent side="bottom">
                <SheetHeader>
                  <SheetTitle>
                    {lang === "en" ? "Saved" : lang === "sc" ? "\u5df2\u50a8\u5b58" : "\u5df2\u5132\u5b58"}
                  </SheetTitle>
                </SheetHeader>
                <SheetBody className="px-4">
                  <FavoritesAndRecents lang={lang} kmbStops={kmbStops} onSelect={onSelectFromLists} />
                </SheetBody>
              </SheetContent>
            )}
          </Sheet>

          <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[420px_1fr]">
            <div className="space-y-4">
              <Card className="rounded-3xl border bg-card/60 p-0 shadow-sm">
                <CardContent className="space-y-4 p-5">
                  <ModeTabs lang={lang} value={mode} onChange={setMode} />

                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{heading}</div>
                      <div className="text-xs text-muted-foreground">{t.searchPin}</div>
                    </div>
                    <LanguageToggle mode={mode} value={lang} onChange={setLang} />
                  </div>

                  <Separator />

                  {mode === "kmb" ? (
                    <KmbPane
                      lang={lang}
                      routeFilterMode={routeFilterMode}
                      onRouteFilterModeChange={setRouteFilterMode}
                      onAddRecent={addRecent}
                      onAddFavorite={addFavorite}
                      canFavoriteRef={canFavoriteRef}
                      selectedItem={selectedItem}
                      onRegisterRefresh={onRegisterRefresh}
                      onStopsChange={setKmbStops}
                      onStateChange={setKmbPaneState}
                    />
                  ) : null}

                  {mode === "mtr" ? (
                    <MtrPane
                      lang={lang}
                      stations={mtrStations}
                      onAddRecent={addRecent}
                      onAddFavorite={addFavorite}
                      canFavoriteRef={canFavoriteRef}
                      onRegisterRefresh={onRegisterRefresh}
                      selectedItem={selectedItem}
                      onStateChange={setMtrPaneState}
                    />
                  ) : null}

                  {mode === "lrt" ? (
                    <LrtPane
                      lang={lang}
                      stations={lrtStations}
                      onAddRecent={addRecent}
                      onAddFavorite={addFavorite}
                      canFavoriteRef={canFavoriteRef}
                      onRegisterRefresh={onRegisterRefresh}
                      selectedItem={selectedItem}
                      onStateChange={setLrtPaneState}
                    />
                  ) : null}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-4">

              {mode === "kmb" ? (
                <KmbResults
                  lang={kmbPaneState?.lang ?? lang}
                  title={kmbPaneState?.title ?? t.kmbTitle}
                  stopCode={kmbPaneState?.stopCode ?? null}
                  routesFilter={kmbPaneState?.routeFilter.routes ?? ""}
                  eta={kmbPaneState?.eta ?? []}
                  routeInfos={kmbPaneState?.routeInfos ?? {}}
                  hasQuery={kmbPaneState?.hasQuery ?? false}
                  error={kmbPaneState?.error ?? null}
                  stale={kmbPaneState?.stale ?? false}
                  lastUpdatedAt={kmbPaneState?.lastUpdatedAt}
                  onRefresh={() => void kmbPaneState?.refresh({ toastOnError: true })}
                  loading={kmbPaneState?.loading}
                  stops={kmbPaneState?.stops ?? undefined}
                  multipleStops={kmbPaneState?.multipleStops}
                />

              ) : null}

              {mode === "mtr" ? (
                <MtrResults
                  title={mtrPaneState?.title ?? t.mtrTitle}
                  lang={mtrPaneState?.lang ?? lang}
                  schedule={mtrPaneState?.schedule ?? null}
                  error={mtrPaneState?.error ?? null}
                  stale={mtrPaneState?.stale ?? false}
                  lastUpdatedAt={mtrPaneState?.lastUpdatedAt ?? null}
                  onRefresh={mtrPaneState?.onRefresh ?? (() => {})}
                  loading={mtrPaneState?.loading}
                />

              ) : null}

              {mode === "lrt" ? (
                <LrtResults
                  title={lrtPaneState?.title ?? t.lrtTitle}
                  lang={lrtPaneState?.lang ?? lang}
                  schedule={lrtPaneState?.schedule ?? null}
                  error={lrtPaneState?.error ?? null}
                  stale={lrtPaneState?.stale ?? false}
                  lastUpdatedAt={lrtPaneState?.lastUpdatedAt ?? null}
                  onRefresh={lrtPaneState?.onRefresh ?? (() => {})}
                  loading={lrtPaneState?.loading}
                />

              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
