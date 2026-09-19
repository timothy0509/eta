'use client'

import * as React from 'react'

import { EtaValue, LivePulse } from '@/components/m3/motion'
import { formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { pickSoonestIsoEta } from '@/lib/eta/pick-soonest-eta'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

/**
 * Shared 15s tick for ETA labels. One interval total no matter how many
 * labels mount; each label re-renders alone without touching the results tree.
 */
let sharedNow = Date.now()
const sharedListeners = new Set<() => void>()
let sharedTimer: ReturnType<typeof setInterval> | null = null

function startSharedTick() {
  if (sharedTimer) return
  sharedTimer = setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      sharedNow = Date.now()
      sharedListeners.forEach((listener) => listener())
    }
  }, 15_000)
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        sharedNow = Date.now()
        sharedListeners.forEach((listener) => listener())
      }
    })
  }
}

function subscribeSharedTick(listener: () => void) {
  startSharedTick()
  sharedListeners.add(listener)
  return () => {
    sharedListeners.delete(listener)
  }
}

function getSharedTick() {
  return sharedNow
}

function useSharedTick(): number {
  const [now, setNow] = React.useState(() => getSharedTick())
  React.useEffect(() => subscribeSharedTick(() => setNow(getSharedTick())), [])
  return now
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
  const now = useSharedTick()
  const { t, tWithParams } = useTranslations(lang)
  const minutes =
    eta != null ? formatRelativeMinutesWithDrift(eta, dataTimestamp ?? undefined, now) : null
  const arriving = minutes !== null && !Number.isNaN(minutes) && minutes <= 0
  const display = formatMinutesDisplay(minutes, t, tWithParams)

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
        {arriving ? <LivePulse /> : null}
        <EtaValue key={display} value={display} />
      </span>
    )
  }

  if (arriving) {
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
 * Ticking "soonest ETA" pill for route-stop timeline rows. Ticks alone so
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
  const now = useSharedTick()
  const { t, tWithParams } = useTranslations(lang)
  const soonest = pickSoonestIsoEta(etas, now)
  const minutes = soonest.minutes

  if (minutes === null) {
    return <span className={cn('text-on-surface-variant m3-label-md', className)}>—</span>
  }

  const isArriving = soonest.arriving || minutes <= 0
  const display = isArriving ? t('common.now') : tWithParams('common.minutes', { count: minutes })

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
})
