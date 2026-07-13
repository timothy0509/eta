'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

type SearchResultsProps = {
  children: React.ReactNode
  className?: string
  empty?: React.ReactNode
  isEmpty?: boolean
}

export function SearchResults({ children, className, empty, isEmpty }: SearchResultsProps) {
  if (isEmpty && empty) {
    return (
      <div className={cn('text-on-surface-variant m3-body-md py-8 text-center', className)}>
        {empty}
      </div>
    )
  }

  return <div className={cn('space-y-1', className)}>{children}</div>
}
