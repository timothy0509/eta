'use client'

import { Check, ChevronDown } from 'lucide-react'
import * as React from 'react'

import { FavoriteSaveButton } from '@/components/eta/favorite-save-button'
import { RouteScheduleSection } from '@/components/eta/route-schedule-section'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslations } from '@/lib/eta/i18n'
import { formatKmbRouteEndpointName } from '@/lib/eta/kmb-stop-name'
import { normalizeOperator } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import type { UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

/** Minimal variant shape the route control bar needs to label its options. */
export type RouteControlOption = {
  key: string
  co: string
  bound: string
  serviceType: string
  operators: string[]
  origin: { en: string; tc: string; sc: string }
  destination: { en: string; tc: string; sc: string }
}

/**
 * Container width at or below which the timetable and save buttons collapse
 * to icons. The row marks itself `@container`, so this only reacts to the
 * bar's own width, not the viewport. Set above the buttons' full-label width
 * so the switch happens before any squeezing: labels are either fully shown
 * or fully hidden, never truncated.
 */
const COLLAPSED_LABEL = '@max-[22.5rem]:hidden'

function directionLabel(bound: string, t: (key: string) => string): string | null {
  if (bound === 'I') return t('common.inbound')
  if (bound === 'O') return t('common.outbound')
  return bound.trim() || null
}

function destinationLabel(option: RouteControlOption, lang: UiLanguage): string {
  return formatKmbRouteEndpointName(pickLang(option.destination, lang), {
    co: option.co,
    lang,
  })
}

/** Operator and special-service suffix, mirroring the old variant pills. */
function suffixLabel(option: RouteControlOption, showOperator: boolean): string | null {
  const head = showOperator ? normalizeOperator(option.co).toUpperCase() : ''
  const tail = option.serviceType !== '1' ? `· ${option.serviceType}` : ''
  return `${head} ${tail}`.trim() || null
}

function optionTitle(
  option: RouteControlOption,
  lang: UiLanguage,
  t: (key: string) => string,
  showOperator: boolean
): string {
  return [directionLabel(option.bound, t), destinationLabel(option, lang)]
    .concat(suffixLabel(option, showOperator) ?? [])
    .filter(Boolean)
    .join(' ')
}

type SelectProps<T extends RouteControlOption> = {
  lang: UiLanguage
  options: T[]
  currentKey: string | null
  onSelect: (option: T) => void
  showOperator?: boolean
  className?: string
}

/**
 * Direction plus route-variant picker as a single dropdown button. The
 * trigger keeps the current direction and destination fully visible; the
 * menu lists every variant with the selected one checked.
 */
export function RouteVariantSelect<T extends RouteControlOption>({
  lang,
  options,
  currentKey,
  onSelect,
  showOperator = false,
  className,
}: SelectProps<T>) {
  const { t } = useTranslations(lang)
  const [open, setOpen] = React.useState(false)
  const current = options.find((option) => option.key === currentKey) ?? options[0]
  if (!current) return null
  const single = options.length < 2
  const direction = directionLabel(current.bound, t)
  const destination = destinationLabel(current, lang)
  const suffix = suffixLabel(current, showOperator)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={single}
          aria-haspopup="listbox"
          aria-expanded={open}
          title={optionTitle(current, lang, t, showOperator)}
          className={cn(
            'bg-primary text-on-primary m3-label-lg ui-press inline-flex min-h-[44px] min-w-0 items-center gap-1 rounded-full px-3.5 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:hover:opacity-100',
            className
          )}
        >
          {direction ? <span className="shrink-0 font-semibold">{direction}</span> : null}{' '}
          <span className="min-w-0 flex-1 truncate text-left">{destination}</span>
          {suffix ? <span className="m3-label-md shrink-0 opacity-80">{suffix}</span> : null}
          {single ? null : <ChevronDown className="h-4 w-4 shrink-0 opacity-80" aria-hidden />}
        </button>
      </PopoverTrigger>
      {single ? null : (
        <PopoverContent
          align="start"
          sideOffset={6}
          className="bg-surface-container-low text-on-surface w-[var(--radix-popover-trigger-width)] min-w-44 rounded-2xl border border-[var(--outline-variant)]/20 p-1.5 shadow-xl"
        >
          <ul role="listbox" aria-label={t('common.route')} className="max-h-72 overflow-y-auto">
            {options.map((option) => {
              const selected = option.key === current.key
              return (
                <li key={option.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    title={optionTitle(option, lang, t, showOperator)}
                    onClick={() => {
                      onSelect(option)
                      setOpen(false)
                    }}
                    className={cn(
                      'ui-press flex min-h-[44px] w-full items-center gap-1.5 rounded-xl px-3 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
                      selected
                        ? 'bg-primary-container text-on-primary-container'
                        : 'hover:bg-[var(--surface-container)]'
                    )}
                  >
                    <span className="m3-label-lg min-w-0 flex-1 truncate">
                      {directionLabel(option.bound, t)}{' '}
                      <span className="font-normal">{destinationLabel(option, lang)}</span>{' '}
                      {suffixLabel(option, showOperator) ? (
                        <span className="m3-label-md opacity-80">
                          {suffixLabel(option, showOperator)}
                        </span>
                      ) : null}
                    </span>
                    {selected ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </PopoverContent>
      )}
    </Popover>
  )
}

type BarProps<T extends RouteControlOption> = SelectProps<T> & {
  /** Base variant key for the timetable lookup: co|route|bound|serviceType. */
  variantKey: string
  onSave: () => void
}

/**
 * Route-view control row: variant dropdown, timetable, and save buttons at
 * 2:1:1 flex weights. All three start from a zero basis so extra room splits
 * proportionally, while `min-w` floors let a button that needs more room
 * take it when space allows. When the bar itself narrows, the timetable and
 * save labels hide first (icons stay), so the variant button keeps its
 * direction and destination fully visible until the very last resort, when
 * its own destination truncates.
 */
export function RouteControlBar<T extends RouteControlOption>({
  lang,
  options,
  currentKey,
  onSelect,
  showOperator = false,
  variantKey,
  onSave,
  className,
}: BarProps<T>) {
  const { t } = useTranslations(lang)
  return (
    <div className={cn('@container flex min-w-0 items-center gap-2', className)}>
      <RouteVariantSelect
        lang={lang}
        options={options}
        currentKey={currentKey}
        onSelect={onSelect}
        showOperator={showOperator}
        className="min-w-0 flex-[2_1_0%]"
      />
      <RouteScheduleSection
        variantKey={variantKey}
        lang={lang}
        bar
        labelClassName={COLLAPSED_LABEL}
        className="min-w-11 flex-[1_1_0%] overflow-hidden"
      />
      <FavoriteSaveButton
        onSave={onSave}
        label={t('common.save')}
        className="min-w-11 flex-[1_1_0%] overflow-hidden px-3"
        labelClassName={cn('whitespace-nowrap', COLLAPSED_LABEL)}
      />
    </div>
  )
}
