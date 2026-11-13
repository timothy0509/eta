'use client'

import { Clock } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/eta/empty-state'
import { PaneSkeleton } from '@/components/eta/pane-skeleton'
import { ResultsHeader } from '@/components/eta/results-header'
import { KmbResults, RouteDepartureRow, type StopChips } from '@/components/eta/results-kmb'
import { StaggerList, staggerClassForIndex } from '@/components/eta/stagger-list'
import {
  fetchKmbFares,
  fetchKmbRouteInfo,
  fetchKmbStopEtas,
  fetchKmbStops,
  type KmbEtaEntryWithLeg,
  type KmbFareVariant,
  type KmbRouteInfoLite,
} from '@/lib/eta/client'
import { parseVariantKey } from '@/lib/eta/eta-db-index'
import { useHeadwaySchedules } from '@/lib/eta/headway/use-headway-schedule'
import { useTranslations } from '@/lib/eta/i18n'
import {
  buildDefaultKey,
  groupEtasByVariant,
  precomputeRenderGroups,
} from '@/lib/eta/kmb-eta-groups'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickLang } from '@/lib/eta/pick-lang'
import {
  SCHOOL_ALL_STOP_IDS,
  SCHOOL_GROUPS,
  groupSchoolEtasByDestination,
  pickSchoolText,
} from '@/lib/eta/school'
import { isKmbStop, type KmbStopSearchItem, type UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'
import type { Company } from 'hk-bus-eta'

type View = 'stops' | 'destination'

const STRINGS: Record<
  UiLanguage,
  {
    title: string
    subtitle: string
    byStops: string
    byDestination: string
    viewLabel: string
    langLabel: string
    dataNote: string
  }
> = {
  tc: {
    title: '校巴站到站時間',
    subtitle: '彩雲邨、白虹樓、啟業邨及彩興苑附近車站',
    byStops: '按車站',
    byDestination: '按目的地',
    viewLabel: '顯示方式',
    langLabel: '語言',
    dataNote: '資料來源：九巴及城巴開放數據，每 15 秒自動更新。',
  },
  en: {
    title: 'School bus stop ETAs',
    subtitle: 'Stops near Choi Wan Estate, Pak Hung House, Kai Yip Estate and Choi Hing Court',
    byStops: 'By stop',
    byDestination: 'By destination',
    viewLabel: 'View',
    langLabel: 'Language',
    dataNote: 'Source: KMB and Citybus open data. Auto-refreshes every 15 seconds.',
  },
  sc: {
    title: '校车站到站时间',
    subtitle: '彩云邨、白虹楼、启业邨及彩兴苑附近车站',
    byStops: '按车站',
    byDestination: '按目的地',
    viewLabel: '显示方式',
    langLabel: '语言',
    dataNote: '资料来源：九巴及城巴开放数据，每 15 秒自动更新。',
  },
}

type BoardData = {
  byStopId: Record<string, KmbEtaEntryWithLeg[]>
  stops: KmbStopSearchItem[]
  routeInfos: Record<string, KmbRouteInfoLite>
  faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  staleByStopId?: Record<string, { stale: boolean; ageMs: number | null }>
}

async function fetchBoardEtas(signal?: AbortSignal) {
  const [etas, stops] = await Promise.all([
    fetchKmbStopEtas(SCHOOL_ALL_STOP_IDS, signal ? { signal } : undefined),
    fetchKmbStops(),
  ])
  return {
    byStopId: etas.byStopId,
    staleByStopId: etas.staleByStopId,
    stops,
  }
}

/** Deferred route details and fares, mirroring the main KMB pane. */
async function fetchBoardExtras(
  byStopId: Record<string, KmbEtaEntryWithLeg[]>,
  signal: AbortSignal,
  infoCache: Map<string, KmbRouteInfoLite>
): Promise<Pick<BoardData, 'routeInfos' | 'faresByVariantKey'>> {
  const seenBaseKeys = new Set<string>()
  const fareVariants: KmbFareVariant[] = []
  for (const eta of Object.values(byStopId).flat()) {
    const baseKey = groupEtasByVariant([eta], {})[0]?.baseKey
    if (!baseKey || seenBaseKeys.has(baseKey)) continue
    seenBaseKeys.add(baseKey)
    fareVariants.push({
      co: String(eta.groupCo ?? eta.co ?? 'kmb') as Company,
      route: (eta.route ?? '').toUpperCase(),
      dir: String(eta.dir ?? ''),
      serviceType: String(eta.service_type ?? ''),
      gtfsId: String(eta.gtfsId ?? '').trim() || undefined,
      jointVariantKey: String(eta.jointVariantKey ?? '').trim() || undefined,
      stopId: String(eta.stop ?? ''),
      destCandidates: [eta.dest_en, eta.dest_tc, eta.dest_sc].filter(Boolean) as string[],
    })
  }

  const missingInfoKeys = Array.from(seenBaseKeys).filter((key) => !infoCache.has(key))
  const settledInfos = await Promise.allSettled(
    missingInfoKeys.slice(0, 30).map(async (key) => {
      const parsed = parseVariantKey(key)
      const info = await fetchKmbRouteInfo({
        co: (parsed.co || 'kmb') as Company,
        route: parsed.route,
        direction: parsed.bound,
        serviceType: parsed.serviceType,
        gtfsId: parsed.gtfsId || undefined,
      })
      return { key, info }
    })
  )
  if (signal.aborted) throw new DOMException('The operation was aborted.', 'AbortError')
  const routeInfos: Record<string, KmbRouteInfoLite> = {}
  for (const item of settledInfos) {
    if (item.status !== 'fulfilled') continue
    infoCache.set(item.value.key, item.value.info)
    routeInfos[item.value.key] = item.value.info
  }

  let faresByVariantKey: BoardData['faresByVariantKey'] = {}
  if (fareVariants.length > 0 && !signal.aborted) {
    try {
      faresByVariantKey = (await fetchKmbFares(fareVariants, { signal })).faresByVariantKey
    } catch {
      // Fares stay hidden when the deferred lookup fails, same as the main pane.
    }
  }
  return { routeInfos, faresByVariantKey }
}

export function SchoolClient() {
  const [view, setView] = React.useState<View>('stops')
  const [lang, setLang] = React.useState<UiLanguage>('tc')
  const [data, setData] = React.useState<BoardData>({
    byStopId: {},
    stops: [],
    routeInfos: {},
    faresByVariantKey: {},
  })
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null)
  const [expandedKey, setExpandedKey] = React.useState<string | null>(null)
  const abortRef = React.useRef<AbortController | null>(null)
  const infoCacheRef = React.useRef(new Map<string, KmbRouteInfoLite>())

  const t = STRINGS[lang]
  const { t: tc } = useTranslations(lang)

  const onToggleExpand = React.useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key))
  }, [])

  const refresh = React.useCallback(async (isInitial: boolean) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    if (isInitial) {
      setLoading(true)
    } else {
      setRefreshing(true)
    }
    setError(null)
    try {
      const etas = await fetchBoardEtas(controller.signal)
      if (controller.signal.aborted) return
      setData((prev) => ({
        byStopId: etas.byStopId,
        stops: etas.stops,
        routeInfos: prev.routeInfos,
        faresByVariantKey: prev.faresByVariantKey,
        staleByStopId: etas.staleByStopId,
      }))
      setLastUpdatedAt(Date.now())
      const extras = await fetchBoardExtras(etas.byStopId, controller.signal, infoCacheRef.current)
      if (controller.signal.aborted) return
      setData((prev) => ({
        ...prev,
        routeInfos: { ...prev.routeInfos, ...extras.routeInfos },
        faresByVariantKey: { ...prev.faresByVariantKey, ...extras.faresByVariantKey },
      }))
    } catch (err) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'Failed to load ETAs')
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [])

  React.useEffect(() => {
    let cancelled = false

    const initialLoad = async () => {
      setLoading(true)
      setError(null)
      try {
        const etas = await fetchBoardEtas()
        if (cancelled) return
        setData((prev) => ({
          byStopId: etas.byStopId,
          stops: etas.stops,
          routeInfos: prev.routeInfos,
          faresByVariantKey: prev.faresByVariantKey,
          staleByStopId: etas.staleByStopId,
        }))
        setLastUpdatedAt(Date.now())
        const extras = await fetchBoardExtras(
          etas.byStopId,
          AbortSignal.timeout(30000),
          infoCacheRef.current
        )
        if (cancelled) return
        setData((prev) => ({
          ...prev,
          routeInfos: { ...prev.routeInfos, ...extras.routeInfos },
          faresByVariantKey: { ...prev.faresByVariantKey, ...extras.faresByVariantKey },
        }))
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load ETAs')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void initialLoad()
    const timer = setInterval(() => {
      void refresh(false)
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
      abortRef.current?.abort()
    }
  }, [refresh])

  const stopChipsById = React.useMemo(() => {
    const next = new Map<string, StopChips>()
    for (const stop of data.stops) {
      const fullName = pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
      const parsed = parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
      next.set(stop.stopId, {
        stopId: stop.stopId,
        fullName,
        name: parsed.name ?? fullName,
        platform: parsed.platform ?? null,
        stopCode: parsed.stopCode ?? null,
      })
    }
    return next
  }, [data.stops, lang])

  const destinationGroups = React.useMemo(
    () => groupSchoolEtasByDestination(data.byStopId, lang),
    [data.byStopId, lang]
  )

  const destinationBaseKeys = React.useMemo(() => {
    const keys = new Set<string>()
    for (const group of destinationGroups) {
      for (const g of groupEtasByVariant(
        group.departures.map((row) => row.entry),
        data.faresByVariantKey,
        buildStopKey,
        baseKeyOfStopKey
      )) {
        keys.add(g.baseKey)
      }
    }
    return Array.from(keys)
  }, [destinationGroups, data.faresByVariantKey])
  const destinationSchedules = useHeadwaySchedules(destinationBaseKeys)

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16">
      <ResultsHeader
        lang={lang}
        mode="kmb"
        title={t.title}
        icon={<Clock className="h-3.5 w-3.5 shrink-0" />}
        subtitle={t.subtitle}
        lastUpdatedAt={lastUpdatedAt ?? undefined}
        loading={loading || refreshing}
        onRefresh={() => void refresh(false)}
      />

      <div className="mt-1 mb-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-2" role="group" aria-label={t.viewLabel}>
          <div className="bg-muted inline-flex rounded-lg p-1">
            <button
              type="button"
              aria-pressed={view === 'stops'}
              onClick={() => setView('stops')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                view === 'stops' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {t.byStops}
            </button>
            <button
              type="button"
              aria-pressed={view === 'destination'}
              onClick={() => setView('destination')}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium',
                view === 'destination' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
            >
              {t.byDestination}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={t.langLabel}>
          <div className="bg-muted inline-flex rounded-lg p-1">
            {(['tc', 'en', 'sc'] as const).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => setLang(code)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm font-medium',
                  lang === code ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
              >
                {code === 'tc' ? '繁' : code === 'sc' ? '简' : 'EN'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {view === 'stops' ? (
        <div className="space-y-8">
          {SCHOOL_GROUPS.map((group) => (
            <section key={group.id} aria-label={pickSchoolText(group.title, lang)}>
              <h2 className="text-lg font-bold">{pickSchoolText(group.title, lang)}</h2>
              <div className="mt-3 space-y-6">
                {group.subgroups.map((sub) => (
                  <SchoolStopsResults
                    key={`${group.id}-${sub.heading.en}`}
                    title={pickSchoolText(sub.heading, lang)}
                    stopIds={sub.stopIds}
                    data={data}
                    lang={lang}
                    loading={loading}
                    error={error}
                    lastUpdatedAt={lastUpdatedAt ?? undefined}
                    onRefresh={() => void refresh(false)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : loading && destinationGroups.length === 0 ? (
        <PaneSkeleton />
      ) : destinationGroups.length === 0 ? (
        <EmptyState title={tc('common.noScheduledBuses')} />
      ) : (
        <div className="space-y-8">
          {destinationGroups.map((group) => (
            <section key={group.destination} aria-label={group.destination}>
              <h2 className="text-lg font-bold">{group.destination}</h2>
              <StaggerList className="mt-3">
                {groupEtasByVariant(
                  group.departures.map((row) => row.entry),
                  data.faresByVariantKey,
                  buildStopKey,
                  baseKeyOfStopKey
                ).map((g, idx) => (
                  <RouteDepartureRow
                    key={g.key}
                    variantKey={g.key}
                    baseKey={g.baseKey}
                    items={g.items}
                    hasEta={g.hasEta}
                    hasFare={g.hasFare}
                    isArrivingLeg={g.isArrivingLeg}
                    routeInfos={data.routeInfos}
                    faresByVariantKey={data.faresByVariantKey}
                    lang={lang}
                    staggerClass={cn('ui-cv-row', staggerClassForIndex(idx))}
                    stopChips={stopChipsForGroup(g.items, group, stopChipsById)}
                    expanded={expandedKey === g.key}
                    onToggleExpand={onToggleExpand}
                    scheduled={destinationSchedules[g.baseKey] ?? null}
                  />
                ))}
              </StaggerList>
            </section>
          ))}
        </div>
      )}

      <footer className="text-muted-foreground mt-10 border-t pt-4 text-xs">
        <p>{t.dataNote}</p>
      </footer>
    </main>
  )
}

/** One row per stop for the same variant, mirroring the main results list. */
function buildStopKey(entry: KmbEtaEntryWithLeg): string {
  const key = buildDefaultKey(entry)
  const parts = key.split('|')
  const leg = parts.pop() ?? '_'
  return [...parts, entry.stop ?? '', leg].join('|')
}

function baseKeyOfStopKey(key: string): string {
  return key.split('|').slice(0, -2).join('|')
}

function stopChipsForGroup(
  items: KmbEtaEntryWithLeg[],
  group: { departures: { entry: KmbEtaEntryWithLeg; stopId: string }[] },
  stopChipsById: Map<string, StopChips>
): StopChips {
  for (const item of items) {
    const stopId = group.departures.find((row) => row.entry === item)?.stopId
    const chips = stopId ? stopChipsById.get(stopId) : undefined
    if (chips) return chips
  }
  const fallbackId = items[0]?.stop ? String(items[0].stop).trim() : null
  return {
    stopId: fallbackId,
    fullName: null,
    name: null,
    platform: null,
    stopCode: null,
  }
}

function SchoolStopsResults({
  title,
  stopIds,
  data,
  lang,
  loading,
  error,
  lastUpdatedAt,
  onRefresh,
}: {
  title: string
  stopIds: string[]
  data: BoardData
  lang: UiLanguage
  loading: boolean
  error: string | null
  lastUpdatedAt?: number
  onRefresh: () => void
}) {
  const etaByStopId = React.useMemo(() => {
    const subset: Record<string, KmbEtaEntryWithLeg[]> = {}
    for (const stopId of stopIds) subset[stopId] = data.byStopId[stopId] ?? []
    return subset
  }, [data.byStopId, stopIds])
  const stops = React.useMemo(
    () =>
      stopIds
        .map((stopId) => data.stops.find((s) => s.stopId === stopId))
        .filter((s): s is KmbStopSearchItem => s !== undefined),
    [data.stops, stopIds]
  )
  const eta = React.useMemo(
    () => stopIds.flatMap((stopId) => etaByStopId[stopId] ?? []),
    [etaByStopId, stopIds]
  )
  const staleByStopId = React.useMemo(() => {
    if (!data.staleByStopId) return undefined
    const subset: Record<string, { stale: boolean; ageMs: number | null }> = {}
    for (const stopId of stopIds) {
      const entry = data.staleByStopId[stopId]
      if (entry) subset[stopId] = entry
    }
    return subset
  }, [data.staleByStopId, stopIds])
  const precomputedGroups = React.useMemo(
    () =>
      precomputeRenderGroups(etaByStopId, stopIds, data.faresByVariantKey, {
        byStop: true,
        flat: false,
      }),
    [etaByStopId, stopIds, data.faresByVariantKey]
  )

  return (
    <KmbResults
      lang={lang}
      title={title}
      onRefresh={onRefresh}
      eta={eta}
      routeInfos={data.routeInfos}
      faresByVariantKey={data.faresByVariantKey}
      hasQuery
      lastUpdatedAt={lastUpdatedAt}
      staleByStopId={staleByStopId}
      error={error}
      loading={loading}
      stops={stops}
      isKeyphraseMode
      etaByStopId={etaByStopId}
      loadedStopIds={stopIds}
      precomputedGroups={precomputedGroups}
    />
  )
}
