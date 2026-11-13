'use client'

import * as React from 'react'
import { Clock, Loader2, RefreshCw } from 'lucide-react'

import { EmptyState } from '@/components/eta/empty-state'
import { RouteBadge } from '@/components/eta/route-badge'
import { TickingKmbMinutes } from '@/components/eta/ticking-eta'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { fetchKmbStopEtas, type KmbEtaEntryWithLeg } from '@/lib/eta/client'
import { formatUiTime } from '@/lib/eta/format'
import { pickLang } from '@/lib/eta/pick-lang'
import {
  collectSchoolEtas,
  groupSchoolEtasByDestination,
  groupSchoolEtasByStop,
  SCHOOL_LOCATIONS,
  SCHOOL_STOP_IDS,
  schoolDepartures,
  type SchoolText,
} from '@/lib/eta/school'
import type { UiLanguage } from '@/lib/eta/types'
import { useAutoRefresh } from '@/lib/eta/use-auto-refresh'
import { cn } from '@/lib/utils'

type ViewMode = 'stop' | 'destination'
type PageLanguage = 'tc' | 'en'

const REFRESH_MS = 30_000

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

function renderDepartureTimes(items: KmbEtaEntryWithLeg[], lang: UiLanguage) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      {schoolDepartures(items).map((entry, index) => (
        <TickingKmbMinutes
          key={`${entry.eta}-${index}`}
          eta={entry.eta}
          dataTimestamp={entry.data_timestamp}
          lang={lang}
          variant="plain"
          className={cn(
            'rounded-md px-1.5 py-1 text-[11px] font-semibold whitespace-nowrap sm:text-xs',
            index === 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          )}
        />
      ))}
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
  const hasData = lastUpdated !== null

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
            <ToggleGroup
              type="single"
              value={language}
              onValueChange={(value) => value && setLanguage(value as PageLanguage)}
              variant="outline"
              size="sm"
              aria-label={pickLang(COPY.language, lang)}
            >
              <ToggleGroupItem value="tc">中</ToggleGroupItem>
              <ToggleGroupItem value="en">EN</ToggleGroupItem>
            </ToggleGroup>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={refresh}
              disabled={refreshing}
              aria-label={pickLang(COPY.refresh, lang)}
              title={pickLang(COPY.refresh, lang)}
            >
              <RefreshCw className={cn(refreshing && 'animate-spin')} />
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(value) => value && setView(value as ViewMode)}
            variant="outline"
            size="sm"
            aria-label={pickLang(COPY.view, lang)}
          >
            <ToggleGroupItem value="stop">{pickLang(COPY.byStop, lang)}</ToggleGroupItem>
            <ToggleGroupItem value="destination">
              {pickLang(COPY.byDestination, lang)}
            </ToggleGroupItem>
          </ToggleGroup>
          <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
            {refreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
            {statusText}
          </p>
        </div>

        {error ? (
          <EmptyState
            title={pickLang(COPY.error, lang)}
            action={
              <Button type="button" variant="outline" size="sm" onClick={refresh}>
                {pickLang(COPY.retry, lang)}
              </Button>
            }
            className="mt-4"
          />
        ) : null}
        {!error && failedStops.length > 0 ? (
          <p className="text-muted-foreground mt-3 text-xs">{pickLang(COPY.partial, lang)}</p>
        ) : null}
      </header>

      {loading ? (
        <EmptyState
          icon={Loader2}
          title={pickLang(COPY.loading, lang)}
          className="mt-6 [&_svg]:animate-spin"
        />
      ) : null}

      {!loading && (!error || hasData) && view === 'stop' ? (
        <div className="mt-6 space-y-4">
          {SCHOOL_LOCATIONS.map((location) => {
            const sections = stopSections.filter((section) => section.locationId === location.id)
            return (
              <Card key={location.id} className="gap-0 overflow-hidden py-0">
                <CardHeader className="border-border border-b px-4 py-3">
                  <CardTitle className="text-sm">{pickLang(location.name, lang)}</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
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
                            <div key={row.key} className="flex items-center gap-3 py-2">
                              <RouteBadge route={row.route} company={row.company} size="sm" />
                              <p className="text-foreground min-w-0 flex-1 truncate text-sm">
                                {pickLang(row.destination, lang)}
                              </p>
                              {renderDepartureTimes(row.items, lang)}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <EmptyState title={pickLang(COPY.noBuses, lang)} className="py-2" />
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : null}

      {!loading && (!error || hasData) && view === 'destination' ? (
        destinationSections.length > 0 ? (
          <div className="mt-6 space-y-4">
            {destinationSections.map((section) => (
              <Card key={section.key} className="gap-0 overflow-hidden py-0">
                <CardHeader className="border-border border-b px-4 py-3">
                  <CardTitle className="text-sm">{pickLang(section.destination, lang)}</CardTitle>
                </CardHeader>
                <CardContent className="divide-border/60 divide-y px-0">
                  {section.rows.map((row) => (
                    <div key={row.key} className="flex items-center gap-3 px-4 py-2.5">
                      <RouteBadge route={row.route} company={row.company} size="sm" />
                      <p className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
                        {pickLang(row.locationName, lang)} · {pickLang(row.groupLabel, lang)}
                      </p>
                      {renderDepartureTimes(row.items, lang)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState icon={Clock} title={pickLang(COPY.noDestinations, lang)} className="mt-6" />
        )
      ) : null}
    </div>
  )
}
