import { AnimatePresence, motion } from 'framer-motion'
import * as React from 'react'

import { cn } from '@/lib/utils'

type Props = {
  expanded: boolean
  onToggle: () => void
  color?: string
  className?: string
  children: React.ReactNode
  panel: React.ReactNode
  toggleLabel: string
}

export function ExpandableEtaRow({
  expanded,
  onToggle,
  color,
  className,
  children,
  panel,
  toggleLabel,
}: Props) {
  const panelId = React.useId()

  return (
    <motion.div
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className={cn(
        'bg-surface-container relative overflow-hidden rounded-2xl border border-[var(--outline-variant)]/10 shadow-sm',
        'hover:bg-surface-container-high focus-within:ring-primary/30 focus-within:ring-2 focus-within:outline-none hover:shadow',
        className
      )}
    >
      {color ? (
        <span
          className="absolute inset-y-2.5 left-0 w-[3px] rounded-full"
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

      <div className="pointer-events-none relative z-10 py-3 pr-3 pl-4">{children}</div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="pointer-events-none relative z-10 pr-3 pb-3 pl-4">{panel}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  )
}
