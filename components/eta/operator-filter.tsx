'use client'

import { useTranslations } from '@/lib/eta/i18n'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export type OperatorCount = {
  code: string
  count: number
}

type Props = {
  operators: OperatorCount[]
  total: number
  value: string | null
  onChange: (code: string | null) => void
  lang: UiLanguage
}

/** Single-select operator chips with counts. Null value means All. */
export function OperatorFilter({ operators, total, value, onChange, lang }: Props) {
  const { t } = useTranslations(lang)
  if (operators.length === 0) return null

  const chip = (active: boolean) =>
    cn(
      'ui-press m3-label-lg inline-flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full px-4 py-2 transition-colors focus-visible:ring-2 focus-visible:outline-none',
      active
        ? 'bg-primary-container text-on-primary-container'
        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
    )

  return (
    <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label={t('common.operator')}>
      <button
        type="button"
        aria-pressed={value === null}
        onClick={() => onChange(null)}
        className={chip(value === null)}
      >
        {t('common.operatorAll')}
        <span className="m3-label-sm opacity-80">{total}</span>
      </button>
      {operators.map((op) => (
        <button
          key={op.code}
          type="button"
          aria-pressed={value === op.code}
          onClick={() => onChange(op.code)}
          className={chip(value === op.code)}
        >
          <span className="uppercase">{op.code}</span>
          <span className="m3-label-sm opacity-80">{op.count}</span>
        </button>
      ))}
    </div>
  )
}
