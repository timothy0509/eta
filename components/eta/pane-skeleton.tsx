'use client'

import * as React from 'react'

import { useTranslations } from '@/lib/eta/i18n'
import { useAppStore } from '@/lib/store'
import { cn } from '@/lib/utils'

/**
 * Skeleton loading state for transport mode panes.
 * Uses the same shimmer rhythm as ResultsSkeleton so the pane
 * and results swap without a visual jump.
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="bg-muted/50 h-7 w-20 animate-pulse rounded-full" />
        <div className="bg-muted/50 h-7 w-20 animate-pulse rounded-full" />
        <div className="bg-muted/50 h-7 w-20 animate-pulse rounded-full" />
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
