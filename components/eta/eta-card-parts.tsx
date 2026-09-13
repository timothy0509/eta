'use client'

import { Accessibility, ArrowDownWideNarrow, ExternalLink, ListOrdered } from 'lucide-react'
import * as React from 'react'

import { KMB_INTERCHANGE_INFO_URL } from '@/lib/eta/direct/shared'
import { timelineFraction, type EtaBadgeKind } from '@/lib/eta/eta-badges'
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
        'm3-label-md inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 font-medium',
        realtime
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface-container-high text-on-surface-variant'
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          realtime ? 'bg-primary' : 'bg-current opacity-40'
        )}
        aria-hidden
      />
      {realtime ? t('common.etaRealtime') : t('common.etaScheduled')}
    </span>
  )
}

/** Low-floor/wheelchair marker. Returns null unless parsed from remarks, never a guess. */
export function WheelchairBadge({ visible, lang }: { visible: boolean; lang: UiLanguage }) {
  const { t } = useTranslations(lang)
  if (!visible) return null
  const label = t('common.etaLowFloor')
  return (
    <span
      className="text-on-surface-variant m3-label-md inline-flex shrink-0 items-center gap-1"
      aria-label={label}
      title={label}
    >
      <Accessibility className="h-4 w-4" aria-hidden />
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

/**
 * Static staged timeline. Dot positions derive from ETA minutes only.
 * Speed always renders as a dash. No GPS, km/h, or distance is implied.
 */
export function EtaTimeline({
  minutes,
  lang,
  stale,
}: {
  minutes: Array<number | null>
  lang: UiLanguage
  stale?: boolean
}) {
  const { t } = useTranslations(lang)
  const dots = minutes.slice(0, 3)
  return (
    <div className={cn(stale && 'opacity-60')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-on-surface-variant m3-label-md">{t('common.etaProgress')}</span>
        <span className="text-on-surface-variant m3-label-md font-mono">
          {t('common.etaSpeed')} —
        </span>
      </div>
      <div
        className="bg-surface-container-high relative mt-1.5 h-1.5 rounded-full"
        role="img"
        aria-label={t('common.etaProgress')}
      >
        {dots.map((value, idx) => (
          <span
            key={idx}
            className="bg-primary absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-white/60"
            style={{ left: `${timelineFraction(value) * 100}%` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  )
}

/** Blue interchange promo. Static copy plus outbound link, never a computed fare. */
export function InterchangePromoBanner({ lang }: { lang: UiLanguage }) {
  const { t } = useTranslations(lang)
  return (
    <div className="rounded-2xl bg-blue-700 p-4 text-white dark:bg-blue-800">
      <div className="m3-title-md font-medium">{t('common.etaInterchangeTitle')}</div>
      <p className="m3-body-md mt-1 opacity-90">{t('common.etaInterchangeBody')}</p>
      <a
        className="m3-label-lg mt-2 inline-flex items-center gap-1.5 underline underline-offset-2"
        href={KMB_INTERCHANGE_INFO_URL}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t('common.etaInterchangeCta')}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </a>
    </div>
  )
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
