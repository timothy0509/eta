'use client'

import * as React from 'react'

import { ChevronRight } from 'lucide-react'

import { RouteBadge } from '@/components/eta/route-badge'
import { staggerClassForIndex } from '@/components/eta/stagger-list'
import { Marquee } from '@/components/ui/marquee'
import { formatKmbRouteEndpointName } from '@/lib/eta/kmb-stop-name'
import { useTranslations } from '@/lib/eta/i18n'
import { formatOperatorCode } from '@/lib/eta/operator-label'
import { getOperatorColor } from '@/lib/eta/operator-colors'
import { pickLang } from '@/lib/eta/pick-lang'
import { getKeyStops } from '@/lib/eta/route-search'
import type { RouteMatchReason, RouteSearchEntry } from '@/lib/eta/route-search'
import type { KmbStopSearchItem, UiLanguage } from '@/lib/eta/types'
import { cn } from '@/lib/utils'

type Props = {
  entry: RouteSearchEntry
  stopsById: Map<string, KmbStopSearchItem>
  lang: UiLanguage
  index: number
  matchReason?: RouteMatchReason
  usageByStopName?: Map<string, number>
  onSelect: () => void
}

/** Rich route result: badge, operator, origin to destination, key stops. */
export function RouteResultCard({
  entry,
  stopsById,
  lang,
  index,
  matchReason,
  usageByStopName,
  onSelect,
}: Props) {
  const { t } = useTranslations(lang)
  const keyStops = React.useMemo(
    () => getKeyStops(entry, stopsById, lang, 7, usageByStopName),
    [entry, stopsById, lang, usageByStopName]
  )
  const origin = formatKmbRouteEndpointName(pickLang(entry.origin, lang), {
    co: entry.co,
    lang,
  })
  const destination = formatKmbRouteEndpointName(pickLang(entry.destination, lang), {
    co: entry.co,
    lang,
  })

  const visibleText = `${origin} ${destination} ${keyStops.join(' ')}`.toLowerCase()
  const showReason =
    matchReason &&
    matchReason.kind !== 'number' &&
    !visibleText.includes(matchReason.text.toLowerCase())

  const operators = entry.operators.length > 0 ? entry.operators : [entry.co]
  const operatorColor =
    operators.length > 1
      ? `linear-gradient(180deg, ${operators
          .map((op, opIndex) => {
            const start = Math.round((opIndex / operators.length) * 10000) / 100
            const end = Math.round(((opIndex + 1) / operators.length) * 10000) / 100
            return `${getOperatorColor(op)} ${start}% ${end}%`
          })
          .join(', ')})`
      : getOperatorColor(operators[0] ?? entry.co)
  const operatorName = operators.map((op) => formatOperatorCode(op)).join(' + ')

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'ui-press bg-surface-container hover:bg-surface-container-high relative flex min-h-[64px] w-full overflow-hidden rounded-2xl py-4 pr-4 pl-5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none',
        staggerClassForIndex(index)
      )}
    >
      <span
        className="absolute inset-y-2.5 left-0 w-1 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
        style={{ background: operatorColor }}
        aria-hidden
      />
      <span className="flex w-full items-center gap-2">
        {/* Joint badge follows the primary operator preference, so the same
        joint route can recolor when the preference flips. The left-edge
        strip shows the operator color instead of a text pill; the sr-only
        span below keeps the operator name for assistive tech. */}
        <RouteBadge route={entry.route} company={entry.co} size="lg" />
        <span className="sr-only">{operatorName}</span>
        <span className="block min-w-0 flex-1 overflow-hidden">
          <Marquee
            title={`${origin} ${entry.directions.length > 1 ? '↔' : '→'} ${destination}`}
            className="text-on-surface m3-title-md w-full"
          >
            {origin} {entry.directions.length > 1 ? '↔' : '→'} {destination}
          </Marquee>
          {keyStops.length > 0 && (
            <span className="text-on-surface-variant m3-body-md flex w-full items-center gap-1 overflow-hidden">
              <span className="shrink-0">{t('kmb.via')}</span>
              <Marquee
                title={keyStops.join(' · ')}
                className="text-on-surface-variant m3-body-md min-w-0 flex-1"
              >
                {keyStops.join(' · ')}
              </Marquee>
            </span>
          )}
          {showReason && (
            <span className="text-on-surface-variant m3-label-md block w-full truncate">
              • {matchReason.text}
            </span>
          )}
        </span>
        <ChevronRight aria-hidden className="text-on-surface-variant h-4 w-4 shrink-0" />
      </span>
    </button>
  )
}
