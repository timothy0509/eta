'use client'

import { ChevronDown } from 'lucide-react'
import * as React from 'react'

import { ExpandableEtaRow } from '@/components/eta/expandable-eta-row'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { EtaValue, LivePulse } from '@/components/m3/motion'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export function SoonestEtaPill({
  minutes,
  lang,
  arriving,
}: {
  minutes: number | null
  lang: UiLanguage
  arriving?: boolean
}) {
  const { t } = useTranslations(lang)

  if (minutes === null) {
    return <span className="text-on-surface-variant m3-label-md">—</span>
  }

  const isArriving = arriving ?? minutes <= 0

  const display = isArriving ? t('common.now') : `${minutes} ${t('common.minutesUnit')}`

  if (isArriving) {
    return (
      <div className="bg-primary-container text-on-primary-container flex items-center gap-1.5 rounded-full px-3 py-1">
        <LivePulse />
        <span className="m3-title-md">
          <EtaValue key={display} value={display} />
        </span>
      </div>
    )
  }

  return (
    <span className="text-on-surface font-tabular shrink-0 text-base font-semibold tracking-tight sm:text-xl">
      <EtaValue key={display} value={display} />
    </span>
  )
}

/**
 * Stack of stop cards. Each direct child keeps its own stagger slot so long
 * route timelines stay cheap offscreen via content-visibility.
 */
export function RouteStopTimeline({
  children,
  className,
}: {
  lineColor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-2', className)}>
      {React.Children.map(children, (child, idx) => (
        <div className={cn('ui-cv-row', staggerClassForIndex(idx))}>{child}</div>
      ))}
    </div>
  )
}

function StopPanel({ children }: { children: React.ReactNode }) {
  return <div className="space-y-2">{children}</div>
}

/**
 * Expandable stop card for route mode. Mirrors the stop-mode ETA card:
 * collapsed header with name plus soonest ETA, expanding to the full
 * per-departure breakdown in the panel.
 */
export function RouteStopCard({
  expanded,
  onToggle,
  color,
  seq,
  name,
  subtitle,
  eta,
  panel,
  toggleLabel,
  selectLabel,
  onSelect,
}: {
  expanded?: boolean
  onToggle: () => void
  color?: string
  seq?: React.ReactNode
  name: React.ReactNode
  subtitle?: React.ReactNode
  eta?: React.ReactNode
  panel: React.ReactNode
  toggleLabel?: string
  selectLabel?: string
  onSelect?: () => void
}) {
  const isExpanded = Boolean(expanded)
  const hasSelect = Boolean(onSelect) && Boolean(selectLabel)

  const header = (
    <div className="flex items-center gap-3">
      {seq !== undefined && seq !== null ? (
        <span
          aria-hidden
          className="bg-surface-container-high text-on-surface-variant font-tabular m3-label-lg flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        >
          {seq}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="m3-body-md text-on-surface truncate font-medium">{name}</div>
        {subtitle && !isExpanded ? (
          <div className="text-on-surface-variant m3-label-md truncate font-mono">{subtitle}</div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {!isExpanded ? eta : null}
        <ChevronDown
          className={cn('text-on-surface-variant ui-chevron h-4 w-4', isExpanded && 'rotate-180')}
        />
      </div>
    </div>
  )

  return (
    <ExpandableEtaRow
      expanded={isExpanded}
      onToggle={onToggle}
      color={color}
      panel={
        <StopPanel>
          {panel}
          {hasSelect ? (
            <div className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect?.()
                }}
                className="text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface pointer-events-auto inline-flex h-8 shrink-0 items-center rounded-full px-3 transition-colors"
              >
                <span className="m3-label-md">{selectLabel}</span>
              </button>
            </div>
          ) : null}
        </StopPanel>
      }
      toggleLabel={toggleLabel ?? (typeof name === 'string' ? name : 'stop')}
    >
      {header}
    </ExpandableEtaRow>
  )
}
