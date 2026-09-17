'use client'

import { Info } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type Props = {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  hint?: string | null
  action?: React.ReactNode
  className?: string
}

/**
 * One empty/error placeholder idiom for the whole app: icon plus
 * title plus optional hint plus optional action (e.g. retry).
 * Announced politely so screen readers pick up async state changes.
 */
export function EmptyState({ icon: Icon = Info, title, hint, action, className }: Props) {
  return (
    <div
      role="status"
      className={cn(
        'text-on-surface-variant m3-body-md flex flex-col items-center justify-center gap-2 px-4 py-8 text-center',
        className
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <p className="text-on-surface m3-title-md">{title}</p>
      {hint ? <p className="max-w-sm">{hint}</p> : null}
      {action}
    </div>
  )
}
