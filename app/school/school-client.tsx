'use client'

import * as React from 'react'
import { Loader2, RefreshCw } from 'lucide-react'

import { RouteBadge } from '@/components/eta/route-badge'
import { fetchKmbStopEtas, type KmbEtaEntryWithLeg } from '@/lib/eta/client'
import { formatRelativeMinutesWithDrift, formatUiTime } from '@/lib/eta/format'
import { pickLang } from '@/lib/eta/pick-lang'
import {
  collectSchoolEtas,
  groupSchoolEtasByDestination,
  groupSchoolEtasByStop,
  SCHOOL_DEPARTURE_LIMIT,
  SCHOOL_LOCATIONS,
  SCHOOL_STOP_IDS,
  type SchoolDeparture,
  type SchoolRouteRow,
  type SchoolText,
} from '@/lib/eta/school'
import type { UiLanguage } from '@/lib/eta/types'
import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import { cn } from '@/lib/utils'

type ViewMode = 'stop' | 'destination'
type PageLanguage = 'tc' | 'en'

const REFRESH_MS = 30_000
const TICK_MS = 15_000

const COPY = {
  title: { en: 'School ETAs', tc: '學校到站時間', sc: '学校到站时间' } satisfies SchoolText,
  subtitle: {
    en: 'Live arrivals for the stops near school',
    tc: '學校附近車站的實時到站時間',
    sc: '学校附近车站的实时到站时间',
  } satisfies SchoolText,
  byStop: { en: 'By stop', tc: '按車站', sc: '按车站' } satisfies SchoolText,
  byDestination: {
    en: 'By destination',
    tc: '按目的地',
    sc: '按目的地',
  } satisfies SchoolText,
  view: { en: 'View', tc: '檢視', sc: '查看' } satisfies SchoolText,
  language: { en: 'Language', tc: '語言', sc: '语言' } satisfies SchoolText,
  now: { en: 'Now', tc: '即將到達', sc: '即将到达' } satisfies SchoolText,
  minutes: { en: '{count} min', tc: '{count} 分', sc: '{count} 分' } satisfies SchoolText,
  noBuses: { en: 'No upcoming buses', tc: '暫無班次', sc: '暂无班次' } satisfies SchoolText,
  updated: { en: 'Updated {time}', tc: '更新於 {time}', sc: '更新于 {time}' } satisfies SchoolText,
  updating: { en: 'Updating…', tc: '更新中…', sc: '更新中…' } satisfies SchoolText,
  refresh: { en: 'Refresh', tc: '重新整理', sc: '刷新' } satisfies SchoolText,
  retry: { en: 'Try again', tc: '再試一次', sc: '再试一次' } satisfies SchoolText,
  loading: {
    en: 'Loading arrivals…',
    tc: '正在載入到站時間…',
    sc: '正在载入到站时间…',
  } satisfies SchoolText,
  error: {
    en: 'Could not load arrivals. Check your connection and try again.',
    tc: '無法載入到站時間，請檢查網絡後再試。',
    sc: '无法载入到站时间，请检查网络后再试。',
  } satisfies SchoolText,
  partial: {
    en: 'Some stops could not be loaded.',
    tc: '部分車站未能載入。',
    sc: '部分车站未能载入。',
  } satisfies SchoolText,
  noDestinations: {
    en: 'No upcoming buses right now.',
    tc: '暫時沒有班次。',
    sc: '暂时没有班次。',
  } satisfies SchoolText,
}

function formatMinutes(departure: SchoolDeparture, now: number, lang: UiLanguage): string {
  const minutes = formatRelativeMinutesWithDrift(departure.eta, departure.dataTimestamp, now)
  if (!Number.isFinite(minutes)) return '—'
  if (minutes <= 0) return pickLang(COPY.now, lang)
  return pickLang(COPY.minutes, lang).replace('{count}', String(minutes))
}

function TimePills({
  departures,
  now,
  lang,
}: {
  departures: SchoolDeparture[]
  now: number
  lang: UiLanguage
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {departures.slice(0, SCHOOL_DEPARTURE_LIMIT).map((departure, index) => (
        <span
          key={`${departure.eta}-${index}`}
          className={cn(
            'font-tabular rounded-md px-1.5 py-1 text-[11px] font-semibold whitespace-nowrap sm:text-xs',
            index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        >
          {formatMinutes(departure, now, lang)}
        </span>
      ))}
    </div>
  )
}

function StopRouteRow({ row, now, lang }: { row: SchoolRouteRow; now: number; lang: UiLanguage }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <RouteBadge route={row.route} company={row.company} size="sm" />
      <p className="text-foreground min-w-0 flex-1 truncate text-sm">
        {pickLang(row.destination, lang)}
      </p>
      <TimePills departures={row.departures} now={now} lang={lang} />
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="border-border bg-card mt-6 space-y-3 rounded-xl border p-4" aria-busy="true">
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </p>
      <div className="space-y-2">
        <div className="bg-muted h-8 animate-pulse rounded-lg" />
        <div className="bg-muted h-8 animate-pulse rounded-lg" />
        <div className="bg-muted h-8 animate-pulse rounded-lg" />
      </div>
    </div>
  )
}

export default function SchoolClient() {
  const [byStopId, setByStopId] = React.useState<Record<string, KmbEtaEntryWithLeg[]>>({})
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [failedStops, setFailedStops] = React.useState<string[]>([])
  const [lastUpdated, setLastUpdated] = React.useState<number | null>(null)
  const [refreshSeq, setRefreshSeq] = React.useState(0)
  const [view, setView] = React.useState<ViewMode>('stop')
  const [language, setLanguage] = React.useState<PageLanguage>('tc')
  const loadedOnce = React.useRef(false)
  const now = useTickingNow(TICK_MS)
  const lang: UiLanguage = language

  const refresh = React.useCallback(() => {
    setRefreshSeq((value) => value + 1)
  }, [])

  useAutoRefresh(REFRESH_MS, refresh)

  React.useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    const run = async () => {
      if (loadedOnce.current) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }
      setError(false)

      try {
        const result = await fetchKmbStopEtas(SCHOOL_STOP_IDS, { signal: controller.signal })
        if (cancelled || controller.signal.aborted) return
        setByStopId(result.byStopId)
        setFailedStops(result.errors)
        setLastUpdated(Date.now())
        loadedOnce.current = true
      } catch (cause) {
        if (cancelled || controller.signal.aborted) return
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(true)
      } finally {
        if (!cancelled) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    }

    void run()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [refreshSeq])

  const entries = React.useMemo(() => collectSchoolEtas(byStopId), [byStopId])
  const stopSections = React.useMemo(() => groupSchoolEtasByStop(entries), [entries])
  const destinationSections = React.useMemo(() => groupSchoolEtasByDestination(entries), [entries])

  const statusText = error
    ? pickLang(COPY.error, lang)
    : refreshing
      ? pickLang(COPY.updating, lang)
      : lastUpdated
        ? pickLang(COPY.updated, lang).replace('{time}', formatUiTime(new Date(lastUpdated), lang))
        : pickLang(COPY.loading, lang)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {pickLang(COPY.title, lang)}
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">{pickLang(COPY.subtitle, lang)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <div
              className="bg-muted text-muted-foreground inline-flex rounded-lg p-0.5 text-xs font-medium"
              role="group"
              aria-label={pickLang(COPY.language, lang)}
            >
              <button
                type="button"
                aria-pressed={language === 'tc'}
                onClick={() => setLanguage('tc')}
                className={cn(
                  'rounded-md px-2 py-1 transition-colors',
                  language === 'tc'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:text-foreground'
                )}
              >
                中
              </button>
              <button
                type="button"
                aria-pressed={language === 'en'}
                onClick={() => setLanguage('en')}
                className={cn(
                  'rounded-md px-2 py-1 transition-colors',
                  language === 'en'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'hover:text-foreground'
                )}
              >
                EN
              </button>
            </div>
            <button
              type="button"
              onClick={refresh}
              disabled={refreshing}
              aria-label={pickLang(COPY.refresh, lang)}
              title={pickLang(COPY.refresh, lang)}
              className="border-border bg-background hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div
            className="bg-muted inline-flex rounded-lg p-0.5 text-xs font-medium"
            role="group"
            aria-label={pickLang(COPY.view, lang)}
          >
            <button
              type="button"
              aria-pressed={view === 'stop'}
              onClick={() => setView('stop')}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                view === 'stop'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {pickLang(COPY.byStop, lang)}
            </button>
            <button
              type="button"
              aria-pressed={view === 'destination'}
              onClick={() => setView('destination')}
              className={cn(
                'rounded-md px-3 py-1.5 transition-colors',
                view === 'destination'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {pickLang(COPY.byDestination, lang)}
            </button>
          </div>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {statusText}
          </p>
        </div>

        {error ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive mt-3 flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>{pickLang(COPY.error, lang)}</span>
            <button
              type="button"
              onClick={refresh}
              className="border-destructive/30 hover:bg-destructive/10 shrink-0 rounded-md border px-2 py-1 text-xs font-medium transition-colors"
            >
              {pickLang(COPY.retry, lang)}
            </button>
          </div>
        ) : null}
        {!error && failedStops.length > 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">{pickLang(COPY.partial, lang)}</p>
        ) : null}
      </header>

      {loading ? <LoadingState label={pickLang(COPY.loading, lang)} /> : null}

      {!loading && view === 'stop' ? (
        <div className="mt-6 space-y-4">
          {SCHOOL_LOCATIONS.map((location) => {
            const sections = stopSections.filter((section) => section.locationId === location.id)
            return (
              <section
                key={location.id}
                className="border-border bg-card overflow-hidden rounded-xl border"
              >
                <h2 className="border-border border-b px-4 py-3 text-sm font-semibold">
                  {pickLang(location.name, lang)}
                </h2>
                {sections.map((section) => (
                  <div
                    key={section.groupId}
                    className="border-border border-b px-4 py-3 last:border-b-0"
                  >
                    <h3 className="text-muted-foreground text-[11px] font-semibold tracking-wide uppercase">
                      {pickLang(section.groupLabel, lang)}
                    </h3>
                    {section.routes.length > 0 ? (
                      <div className="divide-border/60 mt-2 divide-y">
                        {section.routes.map((row) => (
                          <StopRouteRow key={row.key} row={row} now={now} lang={lang} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-2 text-sm">
                        {pickLang(COPY.noBuses, lang)}
                      </p>
                    )}
                  </div>
                ))}
              </section>
            )
          })}
        </div>
      ) : null}

      {!loading && view === 'destination' ? (
        destinationSections.length > 0 ? (
          <div className="mt-6 space-y-4">
            {destinationSections.map((section) => (
              <section
                key={section.key}
                className="border-border bg-card overflow-hidden rounded-xl border"
              >
                <h2 className="border-border border-b px-4 py-3 text-sm font-semibold">
                  {pickLang(section.destination, lang)}
                </h2>
                <div className="divide-border/60 divide-y">
                  {section.rows.map((row) => (
                    <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
                      <RouteBadge route={row.route} company={row.company} size="sm" />
                      <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                        {pickLang(row.locationName, lang)} · {pickLang(row.groupLabel, lang)}
                      </p>
                      <TimePills departures={row.departures} now={now} lang={lang} />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground mt-6 text-sm">
            {pickLang(COPY.noDestinations, lang)}
          </p>
        )
      ) : null}
    </div>
  )
}
