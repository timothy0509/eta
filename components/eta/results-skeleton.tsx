'use client'

import { useTranslations } from '@/lib/eta/i18n'
import { useAppStore } from '@/lib/store'

export function ResultsSkeleton() {
  const lang = useAppStore((s) => s.lang)
  const { t } = useTranslations(lang)
  return (
    <div className="space-y-4" role="status" aria-busy aria-label={t('common.loading')}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="bg-muted/50 ui-shimmer h-6 w-40 rounded" />
          <div className="bg-muted/50 ui-shimmer h-4 w-24 rounded" />
        </div>
        <div className="bg-muted/50 ui-shimmer h-10 w-10 rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted/50 ui-shimmer h-24 rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">{t('common.loading')}</span>
    </div>
  )
}
