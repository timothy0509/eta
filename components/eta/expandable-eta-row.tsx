'use client'

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
}

export function ExpandableEtaRow({ expanded, onToggle, color, className, children, panel }: Props) {
  const onKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onToggle()
      }
    },
    [onToggle]
  )

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

      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        className="absolute inset-0 z-0 cursor-pointer"
      />

      <div className="pointer-events-none relative z-10 py-3 pr-3 pl-4">{children}</div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
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
