import * as React from 'react'

import { cn } from '@/lib/utils'

type Props = {
  expanded: boolean
  onToggle: () => void
  /**
   * Left-edge strip color. For KMB entries this is the operator color from
   * `getOperatorColor`, not the route badge color.
   */
  color?: string
  className?: string
  flush?: boolean
  children: React.ReactNode
  panel: React.ReactNode
  toggleLabel: string
}

export function ExpandableEtaRow({
  expanded,
  onToggle,
  color,
  className,
  flush,
  children,
  panel,
  toggleLabel,
}: Props) {
  const panelId = React.useId()

  return (
    <div
      className={cn(
        'bg-surface-container relative overflow-hidden rounded-2xl border border-[var(--outline-variant)]/10 shadow-sm',
        'hover:bg-surface-container-high focus-within:ring-primary/30 focus-within:ring-2 focus-within:outline-none hover:shadow',
        className
      )}
    >
      {color ? (
        <span
          className="absolute inset-y-2.5 left-0 w-1 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.08)] dark:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.12)]"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : null}

      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        aria-label={toggleLabel}
        onClick={onToggle}
        className="absolute inset-0 z-0 cursor-pointer"
      />

      <div className={cn('pointer-events-none relative z-10', flush ? 'p-0' : 'py-3 pr-3 pl-4')}>
        {children}
      </div>

      <div
        id={panelId}
        data-open={expanded}
        className={cn(
          'ui-expand-panel grid motion-reduce:transition-none',
          expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
        aria-hidden={!expanded}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            data-open={expanded}
            className={cn(
              'ui-expand-inner pointer-events-none relative z-10 pr-3 pb-3 pl-4',
              expanded ? 'translate-y-0' : '-translate-y-1.5'
            )}
          >
            {panel}
          </div>
        </div>
      </div>
    </div>
  )
}
