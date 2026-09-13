'use client'

import { ArrowDownWideNarrow, ListOrdered } from 'lucide-react'
import * as React from 'react'

import type { EtaBadgeKind } from '@/lib/eta/eta-badges'
import { formatUiTime } from '@/lib/eta/format'
import { useTranslations } from '@/lib/eta/i18n'
import { formatRelativeAgeLabel, isStaleByAge, type StaleMode } from '@/lib/eta/stale'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

/** Scheduled vs realtime pill. Reuses the Stream D realtime heuristics via resolveEtaBadge. */
export function EtaRealtimeBadge({ badge, lang }: { badge: EtaBadgeKind; lang: UiLanguage }) {
  const { t } = useTranslations(lang)
  const realtime = badge === 'realtime'
  return (
    <span
      className={cn(
        'm3-label-md inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-medium ring-1 ring-black/5',
        realtime
          ? 'bg-[#dcfce7] text-[#15803d] ring-[#15803d]/20 dark:bg-emerald-500/15 dark:text-emerald-300'
          : 'bg-[#fffbeb] text-[#92400e] ring-[#92400e]/20 dark:bg-amber-500/15 dark:text-amber-300'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          realtime ? 'bg-[#15803d] dark:bg-emerald-400' : 'bg-current opacity-40'
        )}
        aria-hidden
      />
      {realtime ? t('common.etaRealtime') : t('common.etaScheduled')}
    </span>
  )
}

/**
 * ETA numeral color: green when due within 2 min, amber for scheduled
 * (non-realtime) departures, otherwise concept blue.
 */
export function etaNumeralClass(
  minutes: number | null,
  badge: EtaBadgeKind
):
  | 'eta-numeral eta-numeral-soon'
  | 'eta-numeral eta-numeral-normal'
  | 'eta-numeral eta-numeral-scheduled' {
  if (badge === 'scheduled') return 'eta-numeral eta-numeral-scheduled'
  if (minutes !== null && !Number.isNaN(minutes) && minutes <= 2)
    return 'eta-numeral eta-numeral-soon'
  return 'eta-numeral eta-numeral-normal'
}

/** API status footer. Falls back to plain updated-at text when cache info is absent. */
export function ApiStatusFooter({
  lang,
  mode,
  lastUpdatedAt,
  stale,
}: {
  lang: UiLanguage
  mode: StaleMode
  lastUpdatedAt?: number | null
  stale?: boolean
}) {
  const { t, tWithParams } = useTranslations(lang)
  const showStale = Boolean(stale || isStaleByAge({ lastUpdatedAt, mode }))
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null
  const ageLabel = formatRelativeAgeLabel({ lastUpdatedAt, lang })
  return (
    <p
      className={cn(
        'text-on-surface-variant m3-label-md flex flex-wrap items-center gap-1.5',
        showStale && 'opacity-70'
      )}
      aria-live="polite"
    >
      {updatedAt ? (
        <>
          <span>{tWithParams('common.updated', { time: formatUiTime(updatedAt, lang) })}</span>
          {ageLabel ? (
            <>
              <span aria-hidden>·</span>
              <span>{ageLabel}</span>
            </>
          ) : null}
        </>
      ) : (
        <span>{t('common.noDataYet')}</span>
      )}
      {showStale ? (
        <>
          <span aria-hidden>·</span>
          <span className="text-error">{t('common.stale')}</span>
        </>
      ) : null}
    </p>
  )
}

/** Sort-by-time toggle. Works in the desktop column and the mobile stacked list. */
export function SortByTimeToggle({
  active,
  onToggle,
  lang,
}: {
  active: boolean
  onToggle: () => void
  lang: UiLanguage
}) {
  const { t } = useTranslations(lang)
  const label = active ? t('common.etaRouteOrder') : t('common.etaSortByTime')
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 transition-colors',
        active
          ? 'bg-primary-container text-on-primary-container'
          : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
      )}
    >
      {active ? (
        <ListOrdered className="h-5 w-5" aria-hidden />
      ) : (
        <ArrowDownWideNarrow className="h-5 w-5" aria-hidden />
      )}
      <span className="m3-label-md hidden sm:inline">{label}</span>
    </button>
  )
}
