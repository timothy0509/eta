'use client'

import { RefreshCw } from 'lucide-react'

import { cn } from '@/lib/utils'

type Props = {
  ageMs: number | null
  stale: boolean
  loading: boolean
  onRefresh: () => void
  intervalSec: number
  className?: string
}

function formatAge(ageMs: number | null): string {
  if (ageMs === null || ageMs < 0) return '--'
  const seconds = Math.floor(ageMs / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h`
}

export function RefreshPulse({ ageMs, stale, loading, onRefresh, intervalSec, className }: Props) {
  const age = formatAge(ageMs)
  const ageLabel =
    ageMs === null ? 'age unknown' : `${Math.max(0, Math.round(ageMs / 1000))} seconds old`

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'border-trackline bg-platform text-ink inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap'
        )}
        role="status"
        aria-live="polite"
      >
        <span
          aria-hidden
          className={cn('h-1.5 w-1.5 rounded-full', stale ? 'bg-signal-lost' : 'bg-signal-now')}
        />
        <span className="font-mono tabular-nums" aria-hidden>
          {age}
        </span>
        <span className="sr-only">{ageLabel}</span>
        {stale ? <span aria-hidden>stale</span> : null}
      </span>
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        aria-label={`Refresh, data ${ageLabel}, every ${intervalSec} seconds`}
        title={`Auto refresh every ${intervalSec}s`}
        className="border-trackline text-ink flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border transition-colors hover:opacity-80 focus-visible:outline-2 disabled:opacity-50"
      >
        <RefreshCw className={cn('h-5 w-5', loading && 'animate-spin')} aria-hidden />
      </button>
    </div>
  )
}
