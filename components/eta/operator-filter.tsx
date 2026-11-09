'use client'

import { ListFilter } from 'lucide-react'

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslations } from '@/lib/eta/i18n'
import { getOperatorColor } from '@/lib/eta/operator-colors'
import { formatOperatorCode } from '@/lib/eta/operator-label'
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

/** Small filter button that opens a checklist of operators. Empty value means All. */
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

  const triggerLabel = allActive
    ? t('common.operator')
    : tWithParams('common.operatorFilterActive', { count: selected.size })

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          title={triggerLabel}
          className={cn(
            'ui-press relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none',
            allActive
              ? 'bg-surface-container text-on-surface-variant hover:text-on-surface'
              : 'bg-primary-container text-on-primary-container'
          )}
        >
          <ListFilter className="h-5 w-5" aria-hidden />
          {selected.size > 0 && (
            <span
              aria-hidden="true"
              className="bg-primary text-on-primary font-tabular m3-label-sm absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 font-semibold"
            >
              {selected.size}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className="bg-surface-container-low text-on-surface w-64 rounded-2xl border border-[var(--outline-variant)]/20 p-2 shadow-xl"
      >
        <div
          className="flex items-center justify-between gap-2 px-2 pt-1 pb-2"
          role="group"
          aria-label={t('common.operator')}
        >
          <span className="m3-label-lg font-semibold">{t('common.operator')}</span>
          {!allActive && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="ui-press rounded-full px-2 py-1 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
            >
              <span className="m3-label-md">{t('common.clear')}</span>
            </button>
          )}
        </div>
        <ul className="max-h-64 space-y-0.5 overflow-y-auto pb-1">
          <li>
            <label className="ui-press flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 transition-colors focus-within:ring-2 focus-within:outline-none hover:bg-[var(--surface-container)]">
              <input
                type="checkbox"
                checked={allActive}
                onChange={() => onChange([])}
                className="accent-primary h-4 w-4 shrink-0"
              />
              <span className="m3-label-lg min-w-0 flex-1 truncate">{t('common.operatorAll')}</span>
              <span className="text-on-surface-variant m3-label-sm font-tabular">{total}</span>
            </label>
          </li>
          {operators.map((op) => {
            const checked = selected.has(op.code.toLowerCase())
            return (
              <li key={op.code}>
                <label className="ui-press flex cursor-pointer items-center gap-2.5 rounded-xl px-2 py-2 transition-colors focus-within:ring-2 focus-within:outline-none hover:bg-[var(--surface-container)]">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(op.code)}
                    className="accent-primary h-4 w-4 shrink-0"
                  />
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10"
                    style={{ backgroundColor: getOperatorColor(op.code) }}
                  />
                  <span className="m3-label-lg min-w-0 flex-1 truncate">
                    {formatOperatorCode(op.code)}
                  </span>
                  <span className="text-on-surface-variant m3-label-sm font-tabular">
                    {op.count}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
        {!allActive && (
          <p className="text-on-surface-variant m3-label-md px-2 pt-1 pb-1" role="status">
            {tWithParams('kmb.operatorsSelected', { count: selected.size })}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
