'use client'

import * as React from 'react'

import { TickingKmbMinutes } from '@/components/eta/ticking-eta'
import { formatUiTime } from '@/lib/eta/format'
import { useTickingNow } from '@/lib/eta/use-ticking-now'
import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export type SchoolToolbarLabels = {
  viewLabel: string
  langLabel: string
  byStops: string
  byDestination: string
  live: string
  updatedAgo: string
}

export type SchoolView = 'stops' | 'destination'

/**
 * Sticky school toolbar: view switcher, language picker and a live
 * freshness pill. The pill ticks locally; data still refreshes on the
 * board's 15 s poll.
 */
export function SchoolToolbar({
  view,
  onViewChange,
  lang,
  onLangChange,
  lastUpdatedAt,
  labels,
}: {
  view: SchoolView
  onViewChange: (view: SchoolView) => void
  lang: UiLanguage
  onLangChange: (lang: UiLanguage) => void
  lastUpdatedAt: number | null
  labels: SchoolToolbarLabels
}) {
  const now = useTickingNow(15_000)
  const ageMs = lastUpdatedAt ? now - lastUpdatedAt : null
  const fresh = ageMs !== null && ageMs < 60_000
  const statusText =
    ageMs === null
      ? labels.live
      : fresh
        ? labels.live
        : labels.updatedAgo.replace('{n}', String(Math.max(1, Math.floor(ageMs / 60_000))))

  return (
    <div className="bg-background/85 sticky top-0 z-20 -mx-4 border-b px-4 py-2 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-2" role="group" aria-label={labels.viewLabel}>
          <div className="bg-muted inline-flex rounded-full p-1">
            {(
              [
                { value: 'stops', label: labels.byStops },
                { value: 'destination', label: labels.byDestination },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={view === option.value}
                onClick={() => onViewChange(option.value)}
                className={cn(
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  view === option.value
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2" role="group" aria-label={labels.langLabel}>
          <div className="bg-muted inline-flex rounded-full p-1">
            {(['tc', 'en', 'sc'] as const).map((code) => (
              <button
                key={code}
                type="button"
                aria-pressed={lang === code}
                onClick={() => onLangChange(code)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                  lang === code
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {code === 'tc' ? '繁' : code === 'sc' ? '简' : 'EN'}
              </button>
            ))}
          </div>
        </div>
        <span
          className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 text-xs font-medium"
          aria-live="polite"
        >
          <span className="relative flex h-2 w-2">
            {fresh ? (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
            ) : null}
            <span
              className={cn(
                'relative inline-flex h-2 w-2 rounded-full',
                fresh ? 'bg-emerald-500' : 'bg-amber-500'
              )}
            />
          </span>
          {statusText}
        </span>
      </div>
    </div>
  )
}

/**
 * Location section wrapper: numbered mono index plus stop-count badge so
 * parents can scan the four school areas quickly. ETA rows inside stay
 * the main app's components.
 */
export function SchoolLocationSection({
  index,
  title,
  stopCountLabel,
  children,
}: {
  index: number
  title: string
  stopCountLabel: string
  children: React.ReactNode
}) {
  return (
    <section aria-label={title} className="scroll-mt-24">
      <div className="flex items-baseline gap-3">
        <span className="text-muted-foreground font-mono text-sm font-semibold tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </span>
        <h2 className="min-w-0 flex-1 text-lg font-bold tracking-tight">{title}</h2>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
          {stopCountLabel}
        </span>
      </div>
      <div className="mt-3 space-y-6">{children}</div>
    </section>
  )
}

/**
 * Destination header with a live highlight of the soonest departure,
 * rendered by the main app's ticking ETA label so copy and countdown
 * match the rows exactly.
 */
export function SchoolDestinationHeader({
  destination,
  soonest,
  routeCountLabel,
  lang,
}: {
  destination: string
  soonest: KmbEtaEntryWithLeg | null
  routeCountLabel: string
  lang: UiLanguage
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="min-w-0 truncate text-lg font-bold tracking-tight">{destination}</h2>
        <span className="bg-muted text-muted-foreground shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium">
          {routeCountLabel}
        </span>
      </div>
      {soonest?.eta ? (
        <span className="flex shrink-0 items-baseline gap-2">
          <TickingKmbMinutes
            eta={soonest.eta}
            dataTimestamp={soonest.data_timestamp}
            lang={lang}
            variant="header"
            className="text-xl"
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            {formatUiTime(new Date(soonest.eta), lang)}
          </span>
        </span>
      ) : null}
    </div>
  )
}
