'use client'

import { Heart } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'

type StationPaneProps = {
  lang: UiLanguage
  /** Fully controlled search combobox (MTR or LRT). */
  search: React.ReactNode
  /** Whether a station is selected. Drives the save button state. */
  hasSelection: boolean
  onSave: () => void
}

/**
 * Shared shell for the MTR and LRT stop panes: search plus save plus the
 * refresh-registration slot. Schedule wiring, pane-store snapshots, and
 * selection effects stay in each pane because the schedule hooks differ.
 */
export function StationPane({ lang, search, hasSelection, onSave }: StationPaneProps) {
  const { t } = useTranslations(lang)

  return (
    <div className="space-y-4">
      {search}

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button
          size="sm"
          className="min-h-[44px] rounded-full"
          onClick={() => void onSave()}
          disabled={!hasSelection}
        >
          <Heart className="mr-1.5 h-4 w-4" />
          {t('common.save')}
        </Button>
      </div>
    </div>
  )
}
