'use client'

import * as React from 'react'

import { EtaValue, LivePulse } from '@/components/m3/motion'
import { formatExactEtaCountdown, formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { pickSoonestIsoEta } from '@/lib/eta/pick-soonest-eta'
import type { UiLanguage } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Shared tick pools for ETA labels. One interval per precision no matter
 * how many labels mount; each label re-renders alone without touching the
 * results tree. Minute labels use the 15s pool; exact hh:mm:ss countdowns
 * subscribe to the 1s pool.
 */
type TickPool = {
  now: number
  listeners: Set<() => void>
  timer: ReturnType<typeof setInterval> | null
  visibilityBound: boolean
}

const tickPools = new Map<number, TickPool>()

function getTickPool(intervalMs: number): TickPool {
  let pool = tickPools.get(intervalMs)
  if (!pool) {
    pool = { now: Date.now(), listeners: new Set(), timer: null, visibilityBound: false }
    tickPools.set(intervalMs, pool)
  }
  return pool
}

function subscribeTick(intervalMs: number, listener: () => void) {
  const pool = getTickPool(intervalMs)
  pool.listeners.add(listener)

  if (!pool.timer) {
    pool.timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        pool.now = Date.now()
        pool.listeners.forEach((l) => l())
      }
    }, intervalMs)
  }

  if (!pool.visibilityBound && typeof document !== 'undefined') {
    pool.visibilityBound = true
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        pool.now = Date.now()
        pool.listeners.forEach((l) => l())
      }
    })
  }

  return () => {
    pool.listeners.delete(listener)
    if (pool.listeners.size === 0 && pool.timer) {
      clearInterval(pool.timer)
      pool.timer = null
    }
  }
}

function useTick(intervalMs: number): number {
  return React.useSyncExternalStore(
    (listener) => subscribeTick(intervalMs, listener),
    () => getTickPool(intervalMs).now,
    () => Date.now()
  )
}

function formatMinutesDisplay(
  minutes: number | null,
  t: (key: string) => string,
  tWithParams: (key: string, params: Record<string, string | number>) => string
) {
  if (minutes === null || Number.isNaN(minutes)) return '—'
  if (minutes <= 0) return t('common.now')
  return tWithParams('common.minutes', { count: minutes })
}

/**
 * Ticking ETA label for KMB rows. Owns the 15s tick subscription so the
 * 640-line results tree no longer rerenders every tick; only these leaf
 * labels update.
 */
export const TickingKmbMinutes = React.memo(function TickingKmbMinutes({
  eta,
  dataTimestamp,
  lang,
  variant = 'header',
  className,
}: {
  eta?: string | null
  dataTimestamp?: string | null
  lang: UiLanguage
  variant?: 'header' | 'panel' | 'plain'
  className?: string
}) {
  const exactEtaTime = useAppStore((s) => s.exactEtaTime)
  const now = useTick(exactEtaTime ? 1_000 : 15_000)
  const { t, tWithParams } = useTranslations(lang)
  const minutes =
    eta != null ? formatRelativeMinutesWithDrift(eta, dataTimestamp ?? undefined, now) : null
  const arriving = minutes !== null && !Number.isNaN(minutes) && minutes <= 0

  const exact =
    exactEtaTime && eta != null
      ? formatExactEtaCountdown(eta, dataTimestamp ?? undefined, now)
      : null
  const arrivingExact = exact === '00:00:00'
  const display = exact && !arrivingExact ? exact : formatMinutesDisplay(minutes, t, tWithParams)

  if (variant === 'plain') {
    return (
      <span className={className}>
        <EtaValue key={display} value={display} />
      </span>
    )
  }

  if (variant === 'panel') {
    return (
      <span className="font-tabular flex items-center justify-center gap-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
        {arriving || arrivingExact ? <LivePulse /> : null}
        <EtaValue key={display} value={display} />
      </span>
    )
  }

  if (arriving || arrivingExact) {
    const nowText = t('common.now')
    return (
      <span className="bg-primary-container text-on-primary-container m3-label-md sm:m3-label-lg font-tabular flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold sm:px-2.5">
        <LivePulse />
        <EtaValue key={nowText} value={nowText} />
      </span>
    )
  }

  return (
    <span className="text-on-surface font-tabular shrink-0 text-base font-semibold tracking-tight sm:text-xl">
      <EtaValue key={display} value={display} />
    </span>
  )
})

/**
 * Ticking "soonest ETA" label for route-stop rows. Plain tabular text,
 * except the arriving state keeps the pill. Ticks alone so
 * the routes view tree stays static between data refreshes.
 */
export const TickingSoonestPill = React.memo(function TickingSoonestPill({
  etas,
  lang,
  className,
}: {
  etas: Array<{ eta?: string; data_timestamp?: string }>
  lang: UiLanguage
  className?: string
}) {
  const exactEtaTime = useAppStore((s) => s.exactEtaTime)
  const now = useTick(exactEtaTime ? 1_000 : 15_000)
  const { t, tWithParams } = useTranslations(lang)
  const soonest = pickSoonestIsoEta(etas, now)
  const minutes = soonest.minutes

  const exact =
    exactEtaTime && soonest.etaIso
      ? formatExactEtaCountdown(soonest.etaIso, soonest.dataTimestamp, now)
      : null

  if (minutes === null) {
    return <span className={cn('text-on-surface-variant m3-label-md', className)}>—</span>
  }

  const isArriving = soonest.arriving || minutes <= 0 || exact === '00:00:00'
  const display = isArriving
    ? t('common.now')
    : (exact ?? tWithParams('common.minutes', { count: minutes }))

  if (isArriving) {
    return (
      <span
        className={cn(
          'bg-primary-container text-on-primary-container flex items-center gap-1.5 rounded-full px-3 py-1',
          className
        )}
      >
        <LivePulse />
        <span className="m3-title-md">
          <EtaValue key={display} value={display} />
        </span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'text-on-surface font-tabular shrink-0 text-base font-semibold tracking-tight sm:text-xl',
        className
      )}
    >
      <EtaValue key={display} value={display} />
    </span>
  )
})
