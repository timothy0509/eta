'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

type SearchItemProps = {
  children: React.ReactNode
  onClick?: () => void
  className?: string
  active?: boolean
  icon?: React.ReactNode
}

export function SearchItem({ children, onClick, className, active, icon }: SearchItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'bg-surface-container-low hover:bg-surface-container-high flex w-full items-center gap-3 rounded-2xl p-3 text-left transition-colors',
        active && 'bg-primary-container/30 ring-primary/30 ring-2',
        className
      )}
    >
      {icon && (
        <div className="bg-surface text-on-surface-variant flex h-9 w-9 shrink-0 items-center justify-center rounded-full">
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">{children}</div>
    </button>
  )
}
