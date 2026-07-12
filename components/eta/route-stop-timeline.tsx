'use client'

import { MapPin } from 'lucide-react'
import * as React from 'react'

import { LivePulse, StaggerContainer, StaggerItem } from '@/components/m3/motion'
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

  if (isArriving) {
    return (
      <div className="bg-primary-container text-on-primary-container flex items-center gap-1.5 rounded-full px-3 py-1">
        <LivePulse />
        <span className="m3-title-md">{t('common.now')}</span>
      </div>
    )
  }

  return (
    <div className="bg-primary-container text-on-primary-container flex items-center gap-1.5 rounded-full px-3 py-1">
      <LivePulse />
      <span className="m3-title-md">
        {minutes} {lang === 'en' ? 'min' : '分'}
      </span>
    </div>
  )
}

export function RouteStopTimeline({
  lineColor,
  children,
  className,
  stagger = 0.02,
}: {
  lineColor: string
  children: React.ReactNode
  className?: string
  stagger?: number
}) {
  return (
    <StaggerContainer className={cn('relative space-y-0', className)} stagger={stagger}>
      <div
        className="absolute top-2 bottom-2 left-5 w-0.5 -translate-x-1/2"
        style={{ backgroundColor: lineColor }}
      />
      {children}
    </StaggerContainer>
  )
}

export function RouteStopRow({
  name,
  subtitle,
  eta,
}: {
  name: React.ReactNode
  subtitle?: React.ReactNode
  eta?: React.ReactNode
}) {
  return (
    <StaggerItem>
      <div className="relative flex items-center gap-4 py-2">
        <div className="bg-surface border-outline z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border">
          <MapPin className="text-on-surface-variant h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="m3-body-md text-on-surface truncate">{name}</div>
          {subtitle ? <div className="text-on-surface-variant m3-label-md">{subtitle}</div> : null}
        </div>
        {eta ? <div className="flex shrink-0 items-center gap-2">{eta}</div> : null}
      </div>
    </StaggerItem>
  )
}
