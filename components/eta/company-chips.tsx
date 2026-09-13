'use client'

import * as React from 'react'

import { COMPANY_CHIPS, type CompanyChip } from '@/lib/eta/company-filter'
import { useTranslations } from '@/lib/eta/i18n'
import { getRouteBadgeStyle } from '@/lib/eta/route-badge'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

/**
 * Representative route per chip. The dot color comes from
 * getRouteBadgeStyle so chip colors never drift from badge colors.
 */
const CHIP_SAMPLE: Record<CompanyChip, { route: string; company: string } | null> = {
  all: null,
  kmb: { route: '1A', company: 'kmb' },
  ctb: { route: '15', company: 'ctb' },
  'cross-harbour': { route: '307', company: 'kmb' },
  'n-line': { route: 'N216', company: 'kmb' },
}

const CHIP_LABEL_KEY: Record<CompanyChip, string> = {
  all: 'common.companyAll',
  kmb: 'common.companyKmb',
  ctb: 'common.companyCitybus',
  'cross-harbour': 'common.companyCrossHarbour',
  'n-line': 'common.companyNLine',
}

type Props = {
  lang: UiLanguage
  value: CompanyChip
  onChange: (chip: CompanyChip) => void
  counts?: Partial<Record<CompanyChip, number>>
}

export function CompanyChips({ lang, value, onChange, counts }: Props) {
  const { t } = useTranslations(lang)

  return (
    <div role="group" aria-label={t('common.companyFilter')} className="flex flex-wrap gap-2">
      {COMPANY_CHIPS.map((chip) => {
        const active = chip === value
        const sample = CHIP_SAMPLE[chip]
        const dotColor = sample ? getRouteBadgeStyle(sample.route, sample.company).bgColor : null
        const count = counts?.[chip]
        return (
          <button
            key={chip}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(chip)}
            className={cn(
              'm3-label-lg inline-flex min-h-[36px] items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors',
              active
                ? 'bg-primary-container text-on-primary-container'
                : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
            )}
          >
            {dotColor ? (
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: dotColor }}
              />
            ) : null}
            {t(CHIP_LABEL_KEY[chip])}
            {typeof count === 'number' ? (
              <span
                className={cn(
                  'm3-label-sm rounded-full px-1.5',
                  active ? 'bg-primary/15' : 'bg-surface-container'
                )}
              >
                {count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
