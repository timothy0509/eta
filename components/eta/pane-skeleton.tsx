'use client'

import * as React from 'react'

import { useTranslations } from '@/lib/eta/i18n'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

function PaneRow() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="bg-muted/50 h-10 w-14 shrink-0 animate-pulse rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="bg-muted/50 h-4 w-3/4 animate-pulse rounded" />
        <div className="bg-muted/50 h-3 w-1/2 animate-pulse rounded" />
      </div>
      <div className="bg-muted/50 h-8 w-12 shrink-0 animate-pulse rounded-lg" />
    </div>
  )
}

/**
 * Skeleton loading state for transport mode panes.
 * Mirrors the ETA row shape: badge block, two text lines, minute block.
 */
export function PaneSkeleton({ className }: { className?: string }) {
  const lang = useAppStore((s) => s.lang)
  const { t } = useTranslations(lang)
  return (
    <div
      role="status"
      aria-busy
      aria-label={t('common.loading')}
      className={cn('space-y-4', className)}
    >
      <div className="bg-muted/50 h-11 w-full animate-pulse rounded-2xl" />
      <div className="flex flex-wrap items-center gap-2" aria-hidden>
        <div className="bg-muted/50 h-7 w-20 animate-pulse rounded-full" />
        <div className="bg-muted/50 h-7 w-20 animate-pulse rounded-full" />
        <div className="bg-muted/50 h-7 w-20 animate-pulse rounded-full" />
      </div>
      <div className="space-y-3" aria-hidden>
        <PaneRow />
        <PaneRow />
        <PaneRow />
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
