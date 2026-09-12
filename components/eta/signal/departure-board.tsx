'use client'

import { cn } from '@/lib/utils'
import { getSignalForMinutes } from '@/lib/eta/signal-tokens'
import type { UiLanguage } from '@/lib/eta/types'

type Urgency = 'now' | 'soon' | 'later' | 'lost'

type Props = {
  minutes: number | null
  lang: UiLanguage
  stale?: boolean
  showPulse?: boolean
  className?: string
}

function getUrgency(minutes: number | null, stale?: boolean): Urgency {
  return getSignalForMinutes(minutes, Boolean(stale))
}

const URGENCY_LABEL: Record<Urgency, Record<UiLanguage, string>> = {
  now: { en: 'Now', tc: '即將到達', sc: '即将到达' },
  soon: { en: 'Soon', tc: '快到', sc: '快到' },
  later: { en: 'Scheduled', tc: '預定班次', sc: '预定班次' },
  lost: { en: 'No data', tc: '暫無資料', sc: '暂无资料' },
}

const MIN_SUFFIX: Record<UiLanguage, string> = {
  en: 'min',
  tc: '分',
  sc: '分',
}

export function DepartureBoard({ minutes, lang, stale, showPulse, className }: Props) {
  const urgency = getUrgency(minutes, stale)
  const label = URGENCY_LABEL[urgency][lang] ?? URGENCY_LABEL[urgency].tc
  const pulse = Boolean(showPulse && urgency === 'now' && !stale)

  return (
    <div
      className={cn(
        'border-trackline bg-platform text-ink flex items-center gap-3 rounded-xl border px-3 py-2',
        stale && 'opacity-70',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={minutes === null ? label : `${minutes} ${MIN_SUFFIX[lang]}, ${label}`}
    >
      <span
        className="font-tabular text-3xl leading-none font-bold tracking-tight tabular-nums"
        aria-hidden
      >
        {minutes === null ? '—' : minutes}
      </span>
      <span className="flex min-w-0 flex-col gap-1">
        <span
          aria-hidden
          className="font-tabular text-xs leading-none font-medium tabular-nums opacity-70"
        >
          {minutes === null ? '' : MIN_SUFFIX[lang]}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold whitespace-nowrap',
            urgency === 'now' && 'border-signal-now bg-signal-now text-white dark:text-[#0e2a1c]',
            urgency === 'soon' && 'border-signal-soon/40 bg-signal-soon-wash text-signal-soon',
            urgency === 'later' && 'border-signal-later/40 bg-signal-later-wash text-signal-later',
            urgency === 'lost' && 'border-signal-lost/40 bg-signal-lost-wash text-signal-lost'
          )}
        >
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              pulse && 'live-pulse',
              urgency === 'now' && 'bg-white dark:bg-[#0e2a1c]',
              urgency === 'soon' && 'bg-signal-soon',
              urgency === 'later' && 'bg-signal-later',
              urgency === 'lost' && 'bg-signal-lost'
            )}
          />
          {label}
        </span>
      </span>
    </div>
  )
}
