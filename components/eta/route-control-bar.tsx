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
  /** Ref to the trigger's destination span, so the bar can detect truncation. */
  destinationRef?: React.Ref<HTMLSpanElement>
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
  destinationRef,
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
          <span ref={destinationRef} className="min-w-0 flex-1 truncate text-left">
            {destination}
          </span>
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
 * take it when space allows. When the destination would truncate, the
 * timetable and save labels hide first (icons stay, names kept in
 * `aria-label`), freeing that width for the variant button on any screen
 * size. Only when the destination still does not fit does it truncate.
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
  const barRef = React.useRef<HTMLDivElement>(null)
  const destinationRef = React.useRef<HTMLSpanElement>(null)
  const sideWidthsRef = React.useRef<number[]>([])
  const compactRef = React.useRef(false)
  const [compact, setCompact] = React.useState(false)

  // Collapse the side buttons to icons exactly while the destination
  // overflows: hiding the labels and dropping the 1-share flex claim hands
  // that width to the variant button, down to the 44px min-width floor.
  // Labels come back once the destination would still fit with that exact
  // width handed back, so excess room re-expands the buttons on any screen
  // size. Width conservation makes this unable to flap: collapsing grows
  // spare by precisely the reclaimed amount, which is what the restore test
  // then demands on top, so a freshly collapsed bar never qualifies.
  const checkTruncation = React.useCallback(() => {
    const bar = barRef.current
    const destination = destinationRef.current
    if (!bar || !destination) return
    const sides = Array.from(bar.querySelectorAll('[data-collapsible-button]')).map(
      (el) => el as HTMLElement
    )
    const spare = destination.clientWidth - destination.scrollWidth
    if (spare < -1) {
      // Record the expanded widths before collapsing: once compact, these
      // read the 44px floor instead.
      if (!compactRef.current && sides.length > 0) {
        sideWidthsRef.current = sides.map((el) => el.offsetWidth)
      }
      compactRef.current = true
      setCompact(true)
      return
    }
    const current = sides.map((el) => el.offsetWidth)
    const reclaimed = sideWidthsRef.current.reduce(
      (total, expanded, i) => total + Math.max(0, expanded - (current[i] ?? 0)),
      0
    )
    if (spare > reclaimed + 1) {
      compactRef.current = false
      setCompact(false)
    }
  }, [])

  // Text changes (variant, language) do not resize the constrained span, so
  // the observer below would miss them: re-check after every render. Setting
  // the same value bails out, so a settled bar renders no extra pass.
  React.useLayoutEffect(() => {
    checkTruncation()
  })

  // Window resizes, font loads, and panel width changes resize the bar or the
  // destination span and land here.
  React.useEffect(() => {
    if (typeof ResizeObserver === 'undefined') return
    const bar = barRef.current
    const destination = destinationRef.current
    if (!bar || !destination) return
    const observer = new ResizeObserver(checkTruncation)
    observer.observe(bar)
    observer.observe(destination)
    return () => observer.disconnect()
  }, [checkTruncation])

  return (
    <div ref={barRef} className={cn('flex min-w-0 items-center gap-2', className)}>
      <RouteVariantSelect
        lang={lang}
        options={options}
        currentKey={currentKey}
        onSelect={onSelect}
        showOperator={showOperator}
        destinationRef={destinationRef}
        className="min-w-0 flex-[2_1_0%]"
      />
      <RouteScheduleSection
        variantKey={variantKey}
        lang={lang}
        bar
        labelClassName={compact ? 'hidden' : undefined}
        className={cn('min-w-11 overflow-hidden', compact ? 'flex-none' : 'flex-[1_1_0%]')}
      />
      <FavoriteSaveButton
        onSave={onSave}
        label={t('common.save')}
        className={cn('min-w-11 overflow-hidden px-3', compact ? 'flex-none' : 'flex-[1_1_0%]')}
        labelClassName={cn('whitespace-nowrap', compact && 'hidden')}
      />
    </div>
  )
}
