'use client'

import { RefreshCw } from 'lucide-react'
import * as React from 'react'

import { formatUiTime } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { formatRelativeAgeLabel, isStaleByAge } from '@/lib/eta/stale'
import type { TransportMode, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

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
  onRefresh?: () => void
}

/**
 * Shared header for KMB, MTR, and LRT results. Shows the title,
 * updated time with relative age, a stale marker announced to
 * screen readers, and a refresh button with a 44px touch target.
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
  onRefresh,
}: Props) {
  const { t, tWithParams } = useTranslations(lang)
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null
  const relativeAgeLabel = formatRelativeAgeLabel({ lastUpdatedAt, lang })
  const showStale = Boolean(stale || isStaleByAge({ lastUpdatedAt, mode }))

  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-start gap-2">
          <h2 className="text-on-surface m3-title-lg min-w-0 flex-1 truncate font-semibold tracking-tight">
            {title}
          </h2>
          {titleAddon}
        </div>
        <p
          className="text-on-surface-variant m3-label-md mt-1 flex flex-wrap items-center gap-1.5"
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
              <span className="text-error">{t('common.stale')}</span>
            </>
          ) : null}
        </p>
      </div>
      {onRefresh ? (
        <button
          type="button"
          className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface focus-visible:ring-primary/30 flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
          onClick={onRefresh}
          disabled={loading}
          aria-label={t('common.refresh')}
        >
          <RefreshCw className={cn('h-5 w-5', loading && 'ui-spin')} />
        </button>
      ) : null}
    </div>
  )
}
