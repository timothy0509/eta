'use client'

import { BusFront, Van } from 'lucide-react'

import { useTranslations } from '@/lib/eta/i18n'
import type { BusRoutesTab, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

/**
 * Segmented tab bar switching the bus routes view between the franchised
 * bus route list and the green minibus directory.
 */
export function BusRoutesTabs({
  lang,
  tab,
  onTabChange,
}: {
  lang: UiLanguage
  tab: BusRoutesTab
  onTabChange: (tab: BusRoutesTab) => void
}) {
  const { t } = useTranslations(lang)
  const options: Array<{ id: BusRoutesTab; label: string; icon: typeof BusFront }> = [
    { id: 'bus', label: t('gmb.tabBus'), icon: BusFront },
    { id: 'gmb', label: t('gmb.tabGmb'), icon: Van },
  ]
  return (
    <div
      role="group"
      aria-label={t('gmb.routesTabLabel')}
      className="bg-surface-container-low border-outline-variant/20 flex gap-1 rounded-full border p-1 shadow-sm"
    >
      {options.map((option) => {
        const Icon = option.icon
        const active = tab === option.id
        return (
          <button
            key={option.id}
            type="button"
            aria-pressed={active}
            onClick={() => onTabChange(option.id)}
            className={cn(
              'ui-press flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
              active
                ? 'bg-primary-container text-on-primary-container'
                : 'text-on-surface-variant hover:text-on-surface'
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
