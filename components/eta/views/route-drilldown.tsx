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
          className="btn-tonal m3-label-lg ui-press focus-visible:ring-2 focus-visible:outline-none"
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
                className="btn-primary m3-label-lg ui-press mt-2 focus-visible:ring-2 focus-visible:outline-none"
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
