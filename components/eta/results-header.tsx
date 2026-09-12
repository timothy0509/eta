'use client'

import * as React from 'react'

import { RefreshPulse } from '@/components/eta/signal/refresh-pulse'
import { formatUiTime } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { formatRelativeAgeLabel, isStaleByAge } from '@/lib/eta/stale'
import type { TransportMode, UiLanguage } from '@/lib/eta/types'

type Props = {
  lang: UiLanguage
  mode: TransportMode
  title: string
  titleAddon?: React.ReactNode
  subtitle: React.ReactNode
  icon: React.ReactNode
  lastUpdatedAt?: number | null
  stale?: boolean
  loading?: boolean
  intervalSec?: number
  onRefresh?: () => void
}

/**
 * Signal results header: Signal type scale plus RefreshPulse age chip.
 * Keeps last good board visible on stale, retry inline.
 */
export function ResultsHeader({
  lang,
  mode,
  title,
  titleAddon,
  subtitle,
  icon,
  lastUpdatedAt,
  stale,
  loading,
  intervalSec = 15,
  onRefresh,
}: Props) {
  const { t, tWithParams } = useTranslations(lang)
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null
  const relativeAgeLabel = formatRelativeAgeLabel({ lastUpdatedAt, lang })
  const showStale = Boolean(stale || isStaleByAge({ lastUpdatedAt, mode }))
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    if (!lastUpdatedAt) return
    const id = setInterval(() => setNow(Date.now()), 15000)
    return () => clearInterval(id)
  }, [lastUpdatedAt])

  const ageMs = lastUpdatedAt ? Math.max(0, now - lastUpdatedAt) : null

  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <h2 className="signal-stop-name text-ink min-w-0 flex-1 truncate text-xl leading-7 font-semibold tracking-tight">
            {title}
          </h2>
          {titleAddon}
        </div>
        <p
          className="signal-caption text-ink-soft mt-1 flex flex-wrap items-center gap-1.5"
          aria-live="polite"
        >
          {icon}
          {subtitle}
          {updatedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>{tWithParams('common.updated', { time: formatUiTime(updatedAt, lang) })}</span>
              {relativeAgeLabel ? (
                <>
                  <span aria-hidden>·</span>
                  <span>{relativeAgeLabel}</span>
                </>
              ) : null}
            </>
          ) : null}
          {showStale ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-signal-alert">{t('common.stale')}</span>
            </>
          ) : null}
        </p>
      </div>
      {onRefresh ? (
        <RefreshPulse
          ageMs={ageMs}
          stale={showStale}
          loading={Boolean(loading)}
          onRefresh={onRefresh}
          intervalSec={intervalSec}
        />
      ) : null}
    </div>
  )
}
