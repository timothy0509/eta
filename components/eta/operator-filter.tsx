'use client'

import { Check } from 'lucide-react'

import { useTranslations } from '@/lib/eta/i18n'
import { getOperatorColor } from '@/lib/eta/operator-colors'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

export type OperatorCount = {
  code: string
  count: number
}

type Props = {
  operators: OperatorCount[]
  total: number
  /** Empty array means All. */
  value: string[]
  onChange: (codes: string[]) => void
  lang: UiLanguage
}

/** Multi-select operator chips with brand dots and counts. Empty value means All. */
export function OperatorFilter({ operators, total, value, onChange, lang }: Props) {
  const { t, tWithParams } = useTranslations(lang)
  if (operators.length === 0) return null

  const selected = new Set(value.map((v) => v.toLowerCase()))
  const allActive = selected.size === 0

  const toggle = (code: string) => {
    const lower = code.toLowerCase()
    if (selected.has(lower)) {
      onChange(value.filter((v) => v.toLowerCase() !== lower))
    } else {
      const next = Array.from(new Set([...value.map((v) => v.toLowerCase()), lower])).sort((a, b) =>
        a.localeCompare(b)
      )
      onChange(next)
    }
  }

  const chip = (active: boolean) =>
    cn(
      'ui-press m3-label-lg inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none',
      active
        ? 'bg-primary-container text-on-primary-container'
        : 'bg-surface-container-high text-on-surface-variant hover:text-on-surface'
    )

  return (
    <div className="space-y-1.5">
      <div
        className="flex gap-2 overflow-x-auto pb-1"
        role="group"
        aria-label={t('common.operator')}
      >
        <button
          type="button"
          aria-pressed={allActive}
          onClick={() => onChange([])}
          className={chip(allActive)}
        >
          {t('common.operatorAll')}
          <span className="m3-label-sm opacity-80">{total}</span>
        </button>
        {operators.map((op) => {
          const active = selected.has(op.code.toLowerCase())
          return (
            <button
              key={op.code}
              type="button"
              aria-pressed={active}
              onClick={() => toggle(op.code)}
              className={chip(active)}
            >
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                style={{ backgroundColor: getOperatorColor(op.code) }}
              />
              <span className="uppercase">{op.code}</span>
              <span className="m3-label-sm opacity-80">{op.count}</span>
              {active && <Check className="h-3.5 w-3.5" aria-hidden />}
            </button>
          )
        })}
      </div>
      {selected.size > 0 && (
        <div className="text-on-surface-variant m3-label-md flex items-center justify-between">
          <span role="status">
            {tWithParams('kmb.operatorsSelected', { count: selected.size })}
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            className="ui-press rounded-full px-2 py-1 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
          >
            {t('common.clear')}
          </button>
        </div>
      )}
    </div>
  )
}
