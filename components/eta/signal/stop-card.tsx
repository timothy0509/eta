'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

type Props = {
  accentColor: string
  stopName?: string
  code?: string
  expanded: boolean
  onToggle: () => void
  header: React.ReactNode
  panel: React.ReactNode
  className?: string
}

export function StopCard({
  accentColor,
  stopName,
  code,
  expanded,
  onToggle,
  header,
  panel,
  className,
}: Props) {
  const panelId = React.useId()
  const label = stopName ?? code ?? 'Stop details'

  return (
    <section
      aria-label={label}
      className={cn(
        'border-trackline bg-platform text-ink relative overflow-hidden rounded-[16px] border shadow-sm',
        className
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-3 left-0 w-[3px] rounded-full"
        style={{ backgroundColor: accentColor }}
      />
      <h3 className="m-0 text-inherit">
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={onToggle}
          className="flex min-h-[44px] w-full cursor-pointer items-center gap-2 py-3 pr-3 pl-4 text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
        >
          <span className="min-w-0 flex-1">{header}</span>
        </button>
      </h3>
      <div id={panelId} hidden={!expanded} className="pr-3 pb-3 pl-4">
        {expanded ? panel : null}
      </div>
    </section>
  )
}
