'use client'

import { ChevronLeft } from 'lucide-react'
import * as React from 'react'

import { EmptyState } from '@/components/eta/empty-state'
import { ResultsSkeleton } from '@/components/eta/results-skeleton'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'

type RouteDrilldownProps = {
  lang: UiLanguage
  /** Badge, pill, or title identifying the selected route or line. */
  title: React.ReactNode
  onBack: () => void
  loading?: boolean
  /** Error text when the drilldown failed to load. Shows EmptyState plus retry. */
  error?: string | null
  onRetry?: () => void
  children: React.ReactNode
}

/**
 * One drilldown idiom for all three route views: a 44px back button plus
 * title, one ResultsSkeleton load, one EmptyState error with retry.
 */
export function RouteDrilldown({
  lang,
  title,
  onBack,
  loading,
  error,
  onRetry,
  children,
}: RouteDrilldownProps) {
  const { t } = useTranslations(lang)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="bg-secondary-container text-on-secondary-container m3-label-lg inline-flex min-h-[44px] items-center gap-1 rounded-full px-4 py-2 transition-colors hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
          {t('common.back')}
        </button>
        {title}
      </div>

      {loading ? (
        <ResultsSkeleton />
      ) : error ? (
        <EmptyState
          title={t('common.wentWrong')}
          hint={error}
          action={
            onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                className="bg-primary text-on-primary m3-label-lg ui-press mt-2 inline-flex min-h-[44px] items-center rounded-full px-5 py-2 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none"
              >
                {t('common.tryAgain')}
              </button>
            ) : undefined
          }
        />
      ) : (
        children
      )}
    </div>
  )
}
