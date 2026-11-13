'use client'

import * as React from 'react'

import { RouteBadge } from '@/components/eta/route-badge'
import { fetchKmbStopEtas, fetchKmbStops, type KmbEtaEntryWithLeg } from '@/lib/eta/client'
import { formatRelativeMinutesWithDrift, formatUiTime } from '@/lib/eta/format'
import { pickLang } from '@/lib/eta/pick-lang'
import {
  SCHOOL_ALL_STOP_IDS,
  SCHOOL_GROUPS,
  groupSchoolEtasByDestination,
  groupSchoolStopEtas,
  pickSchoolText,
} from '@/lib/eta/school'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

type View = 'stops' | 'destination'

const STRINGS: Record<
  string,
  {
    title: string
    subtitle: string
    byStops: string
    byDestination: string
    viewLabel: string
    langLabel: string
    refresh: string
    refreshing: string
    updatedJustNow: string
    updatedMinutesAgo: string
    loading: string
    loadFailed: string
    retry: string
    noEtas: string
    noDepartures: string
    moreDepartures: string
    fromStop: string
    dataNote: string
  }
> = {
  tc: {
    title: '校車站到站時間',
    subtitle: '彩雲邨、白虹樓、啟業邨及彩興苑附近車站',
    byStops: '按車站',
    byDestination: '按目的地',
    viewLabel: '顯示方式',
    langLabel: '語言',
    refresh: '重新整理',
    refreshing: '更新中…',
    updatedJustNow: '剛剛更新',
    updatedMinutesAgo: '{n} 分鐘前更新',
    loading: '載入班次中…',
    loadFailed: '載入失敗，請再試一次。',
    retry: '重試',
    noEtas: '暫時沒有預定班次',
    noDepartures: '暫時沒有班次',
    moreDepartures: '尚有 {n} 班次',
    fromStop: '由 {stop} 開出',
    dataNote: '資料來源：九巴及城巴開放數據，每 15 秒自動更新。',
  },
  en: {
    title: 'School bus stop ETAs',
    subtitle: 'Stops near Choi Wan Estate, Pak Hung House, Kai Yip Estate and Choi Hing Court',
    byStops: 'By stop',
    byDestination: 'By destination',
    viewLabel: 'View',
    langLabel: 'Language',
    refresh: 'Refresh',
    refreshing: 'Updating…',
    updatedJustNow: 'Updated just now',
    updatedMinutesAgo: 'Updated {n} min ago',
    loading: 'Loading departures…',
    loadFailed: 'Failed to load. Please try again.',
    retry: 'Retry',
    noEtas: 'No scheduled buses',
    noDepartures: 'No departures',
    moreDepartures: '{n} more departures',
    fromStop: 'from {stop}',
    dataNote: 'Source: KMB and Citybus open data. Auto-refreshes every 15 seconds.',
  },
  sc: {
    title: '校车站到站时间',
    subtitle: '彩云邨、白虹楼、启业邨及彩兴苑附近车站',
    byStops: '按车站',
    byDestination: '按目的地',
    viewLabel: '显示方式',
    langLabel: '语言',
    refresh: '刷新',
    refreshing: '更新中…',
    updatedJustNow: '刚刚更新',
    updatedMinutesAgo: '{n} 分钟前更新',
    loading: '载入班次中…',
    loadFailed: '载入失败，请再试一次。',
    retry: '重试',
    noEtas: '暂时没有预定班次',
    noDepartures: '暂时没有班次',
    moreDepartures: '尚有 {n} 班次',
    fromStop: '由 {stop} 开出',
    dataNote: '资料来源：九巴及城巴开放数据，每 15 秒自动更新。',
  },
}

function formatUpdatedLabel(lastUpdatedAt: number | null, now: number, lang: UiLanguage): string {
  const t = STRINGS[lang]
  if (!lastUpdatedAt) return ''
  const diffMin = Math.floor((now - lastUpdatedAt) / 60000)
  if (diffMin < 1) return t.updatedJustNow
  return t.updatedMinutesAgo.replace('{n}', String(diffMin))
}

function EtaTimes({
  items,
  lang,
  now,
}: {
  items: KmbEtaEntryWithLeg[]
  lang: UiLanguage
  now: number
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
      {items.slice(0, 3).map((item, index) => {
        const minutes = item.eta
          ? formatRelativeMinutesWithDrift(item.eta, item.data_timestamp ?? undefined, now)
          : null
        const label =
          minutes === null || Number.isNaN(minutes)
            ? '—'
            : minutes <= 0
              ? minutesLabel(lang)
              : minutesLabel(lang, minutes)
        const clock = item.eta ? formatUiTime(new Date(item.eta), lang) : ''
        return (
          <span
            key={`${item.route}-${item.eta_seq}-${index}`}
            className="flex items-baseline gap-1.5"
          >
            <span className={cn('text-lg font-bold tabular-nums', index === 0 && 'text-xl')}>
              {label}
            </span>
            {clock ? (
              <span className="text-muted-foreground text-xs tabular-nums">{clock}</span>
            ) : null}
          </span>
        )
      })}
    </div>
  )
}

function minutesLabel(lang: UiLanguage, minutes?: number): string {
  if (minutes === undefined) {
    if (lang === 'en') return 'Arriving'
    if (lang === 'sc') return '即将到达'
    return '即將到達'
  }
  if (lang === 'en') return minutes === 1 ? '1 min' : `${minutes} mins`
  if (lang === 'sc') return `${minutes} 分钟`
  return `${minutes} 分鐘`
}

async function fetchSchoolBoard(signal?: AbortSignal) {
  const [etas, stops] = await Promise.all([
    fetchKmbStopEtas(SCHOOL_ALL_STOP_IDS, signal ? { signal } : undefined),
    fetchKmbStops(),
  ])
  const names: Record<string, { en: string; tc: string; sc: string }> = {}
  for (const stop of stops) {
    names[stop.stopId] = { en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }
  }
  return { byStopId: etas.byStopId, names }
}

export function SchoolClient() {
  const [view, setView] = React.useState<View>('stops')
  const [lang, setLang] = React.useState<UiLanguage>('tc')
  const [byStopId, setByStopId] = React.useState<Record<string, KmbEtaEntryWithLeg[]>>({})
  const [stopNames, setStopNames] = React.useState<
    Record<string, { en: string; tc: string; sc: string }>
  >({})
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number | null>(null)
  const [now, setNow] = React.useState(() => Date.now())
  const abortRef = React.useRef<AbortController | null>(null)

  const t = STRINGS[lang]
  const loadFailedMessage = t.loadFailed

  const refresh = React.useCallback(
    async (isInitial: boolean) => {
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
        const data = await fetchSchoolBoard(controller.signal)
        if (controller.signal.aborted) return
        setByStopId(data.byStopId)
        setStopNames(data.names)
        setLastUpdatedAt(Date.now())
        setNow(Date.now())
      } catch (err) {
        if (controller.signal.aborted) return
        setError(err instanceof Error ? err.message : loadFailedMessage)
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [loadFailedMessage]
  )

  React.useEffect(() => {
    let cancelled = false

    const initialLoad = async () => {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchSchoolBoard()
        if (cancelled) return
        setByStopId(data.byStopId)
        setStopNames(data.names)
        setLastUpdatedAt(Date.now())
        setNow(Date.now())
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : loadFailedMessage)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void initialLoad()
    const timer = setInterval(() => {
      setNow(Date.now())
      void refresh(false)
    }, 15000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [refresh, loadFailedMessage])

  const destinationGroups = React.useMemo(
    () => groupSchoolEtasByDestination(byStopId, lang),
    [byStopId, lang]
  )

  const stopDisplayName = React.useCallback(
    (stopId: string) => {
      const name = stopNames[stopId]
      if (name) {
        const picked = pickLang(name, lang)
        if (picked) return picked
      }
      return stopId.length > 12 ? `${stopId.slice(0, 6)}…${stopId.slice(-4)}` : stopId
    },
    [stopNames, lang]
  )

  return (
    <main className="bg-background text-foreground mx-auto w-full max-w-3xl px-4 pt-6 pb-16">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t.subtitle}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
            onClick={() => void refresh(false)}
            disabled={loading || refreshing}
            className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 font-medium disabled:opacity-60"
          >
            {loading || refreshing ? t.refreshing : t.refresh}
          </button>
          {lastUpdatedAt ? (
            <span className="text-muted-foreground text-xs" aria-live="polite">
              {formatUpdatedLabel(lastUpdatedAt, now, lang)}
            </span>
          ) : null}
          {error ? (
            <span className="text-destructive text-xs" role="alert">
              {t.loadFailed}
            </span>
          ) : null}
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
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

      {loading ? (
        <div className="mt-6 space-y-3" aria-busy="true" aria-label={t.loading}>
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="border-muted rounded-lg border p-4">
              <div className="bg-muted h-4 w-1/3 rounded motion-safe:animate-pulse" />
              <div className="bg-muted mt-3 h-6 w-2/3 rounded motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      ) : error && Object.keys(byStopId).length === 0 ? (
        <div className="mt-6 rounded-lg border p-6 text-center">
          <p className="text-sm">{t.loadFailed}</p>
          <button
            type="button"
            onClick={() => void refresh(true)}
            className="bg-primary text-primary-foreground mt-3 rounded-md px-3 py-1.5 text-sm font-medium"
          >
            {t.retry}
          </button>
        </div>
      ) : view === 'stops' ? (
        <div className="mt-6 space-y-8">
          {SCHOOL_GROUPS.map((group) => (
            <section key={group.id} aria-label={pickSchoolText(group.title, lang)}>
              <h2 className="text-lg font-bold">{pickSchoolText(group.title, lang)}</h2>
              <div className="mt-3 space-y-6">
                {group.subgroups.map((sub) => (
                  <div key={`${group.id}-${sub.heading.en}`}>
                    <h3 className="text-muted-foreground text-sm font-semibold">
                      {pickSchoolText(sub.heading, lang)}
                    </h3>
                    <div className="mt-2 space-y-3">
                      {sub.stopIds.map((stopId) => {
                        const entries = byStopId[stopId] ?? []
                        const routeGroups = groupSchoolStopEtas(entries, lang)
                        return (
                          <article key={stopId} className="rounded-lg border p-3">
                            <h4 className="text-sm font-semibold">{stopDisplayName(stopId)}</h4>
                            {routeGroups.length === 0 ? (
                              <p className="text-muted-foreground mt-2 text-sm">{t.noEtas}</p>
                            ) : (
                              <ul className="mt-2 space-y-3">
                                {routeGroups.map((routeGroup) => (
                                  <li
                                    key={routeGroup.key}
                                    className="flex items-start justify-between gap-3"
                                  >
                                    <div className="flex min-w-0 items-start gap-2">
                                      <RouteBadge route={routeGroup.route} size="sm" />
                                      <span className="min-w-0">
                                        <span className="block truncate text-sm font-medium">
                                          {routeGroup.destination || t.noDepartures}
                                        </span>
                                        <span className="text-muted-foreground block text-xs">
                                          {routeGroup.co.toUpperCase()}
                                        </span>
                                      </span>
                                    </div>
                                    <EtaTimes items={routeGroup.items} lang={lang} now={now} />
                                  </li>
                                ))}
                              </ul>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {destinationGroups.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t.noDepartures}</p>
          ) : (
            destinationGroups.map((group) => (
              <section key={group.destination} aria-label={group.destination}>
                <h2 className="text-lg font-bold">{group.destination}</h2>
                <ul className="mt-2 space-y-2">
                  {group.departures.slice(0, 12).map((row, index) => {
                    const minutes = row.entry.eta
                      ? formatRelativeMinutesWithDrift(
                          row.entry.eta,
                          row.entry.data_timestamp ?? undefined,
                          now
                        )
                      : null
                    const label =
                      minutes === null || Number.isNaN(minutes)
                        ? '—'
                        : minutes <= 0
                          ? minutesLabel(lang)
                          : minutesLabel(lang, minutes)
                    return (
                      <li
                        key={`${row.stopId}-${row.entry.route}-${row.entry.eta_seq}-${index}`}
                        className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <RouteBadge route={(row.entry.route ?? '').toUpperCase()} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">
                              {t.fromStop.replace('{stop}', stopDisplayName(row.stopId))}
                            </span>
                            <span className="text-muted-foreground block text-xs">
                              {pickSchoolText(row.location, lang)}
                              {pickSchoolText(row.subgroup, lang)
                                ? ` · ${pickSchoolText(row.subgroup, lang)}`
                                : ''}
                            </span>
                          </span>
                        </span>
                        <span className="text-lg font-bold tabular-nums">{label}</span>
                      </li>
                    )
                  })}
                </ul>
                {group.departures.length > 12 ? (
                  <p className="text-muted-foreground mt-1 text-xs">
                    {t.moreDepartures.replace('{n}', String(group.departures.length - 12))}
                  </p>
                ) : null}
              </section>
            ))
          )}
        </div>
      )}

      <footer className="text-muted-foreground mt-10 border-t pt-4 text-xs">
        <p>{t.dataNote}</p>
      </footer>
    </main>
  )
}
