'use client'

import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export type FareViewMode = 'sections' | 'byStop'

/**
 * Compact segmented fare-display toggle for the route stops header. A quiet
 * control, not a call to action: small type on a flat container, with the
 * active segment lifted only by surface and shadow.
 */
export function FareViewToggle({
  lang,
  mode,
  onChange,
  className,
}: {
  lang: UiLanguage
  mode: FareViewMode
  onChange: (mode: FareViewMode) => void
  className?: string
}) {
  const { t } = useTranslations(lang)
  const options: Array<{ mode: FareViewMode; label: string }> = [
    { mode: 'sections', label: t('kmb.fareSections') },
    { mode: 'byStop', label: t('kmb.fareByStop') },
  ]
  return (
    <div
      className={cn('bg-surface-container flex items-center gap-0.5 rounded-full p-0.5', className)}
      role="group"
      aria-label={t('kmb.fareDisplay')}
    >
      {options.map((option) => (
        <button
          key={option.mode}
          type="button"
          aria-pressed={mode === option.mode}
          onClick={() => onChange(option.mode)}
          className={cn(
            'ui-press m3-label-md inline-flex min-h-[32px] min-w-0 flex-1 items-center justify-center rounded-full px-2 transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex-none sm:justify-start sm:px-2.5',
            mode === option.mode
              ? 'bg-surface-container-lowest text-on-surface font-medium shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          )}
        >
          <span className="truncate">{option.label}</span>
        </button>
      ))}
    </div>
  )
}
