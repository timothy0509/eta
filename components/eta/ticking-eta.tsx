'use client'

import * as React from 'react'

import { EtaValue, LivePulse } from '@/components/m3/motion'
import { formatIsoToExactHms, formatRelativeMinutesWithDrift } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { pickSoonestIsoEta } from '@/lib/eta/pick-soonest-eta'
import type { EtaDisplayFormat, UiLanguage } from '@/lib/eta/types'
import { useAppStore } from '@/lib/store'
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

const noopSubscribe = () => () => {}

/**
 * `active` false keeps the label out of the tick subscription entirely, so
 * ETAs inside collapsed rows stop re-rendering every 15s. The current value
 * is still read during render, so expanding a row shows the right minute.
 */
function useSharedTick(active = true): number {
  return React.useSyncExternalStore(
    active ? subscribeSharedTick : noopSubscribe,
    getSharedTick,
    getSharedTick
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
  active = true,
  format: formatProp,
}: {
  eta?: string | null
  dataTimestamp?: string | null
  lang: UiLanguage
  variant?: 'header' | 'panel' | 'plain'
  className?: string
  /** False inside collapsed panels: render the value without ticking. */
  active?: boolean
  /** Overrides the stored ETA display format, mainly for tests. */
  format?: EtaDisplayFormat
}) {
  const now = useSharedTick(active)
  const { t, tWithParams } = useTranslations(lang)
  const storedFormat = useAppStore((s) => s.etaDisplayFormat)
  const format = formatProp ?? storedFormat
  const minutes =
    eta != null ? formatRelativeMinutesWithDrift(eta, dataTimestamp ?? undefined, now) : null
  const arriving = minutes !== null && !Number.isNaN(minutes) && minutes <= 0
  // Exact mode shows the arrival wall-clock; arriving stays on the Now pill
  // and unparseable ETAs fall back to the countdown.
  const exact = format === 'exact' && eta != null ? formatIsoToExactHms(eta) : null
  const display = exact && !arriving ? exact : formatMinutesDisplay(minutes, t, tWithParams)

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
 * Ticking "soonest ETA" label for route-stop rows. Plain tabular text,
 * except the arriving state keeps the pill. Ticks alone so
 * the routes view tree stays static between data refreshes.
 */
export const TickingSoonestPill = React.memo(function TickingSoonestPill({
  etas,
  lang,
  className,
  format: formatProp,
}: {
  etas: Array<{ eta?: string; data_timestamp?: string }>
  lang: UiLanguage
  className?: string
  /** Overrides the stored ETA display format, mainly for tests. */
  format?: EtaDisplayFormat
}) {
  const now = useSharedTick()
  const { t, tWithParams } = useTranslations(lang)
  const storedFormat = useAppStore((s) => s.etaDisplayFormat)
  const format = formatProp ?? storedFormat
  const soonest = pickSoonestIsoEta(etas, now)
  const minutes = soonest.minutes

  if (minutes === null) {
    return <span className={cn('text-on-surface-variant m3-label-md', className)}>—</span>
  }

  const isArriving = soonest.arriving || minutes <= 0
  const exact = format === 'exact' && soonest.etaIso ? formatIsoToExactHms(soonest.etaIso) : null
  const display =
    exact && !isArriving
      ? exact
      : isArriving
        ? t('common.now')
        : tWithParams('common.minutes', { count: minutes })

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
