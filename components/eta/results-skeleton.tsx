import * as React from 'react'

function ResultsRow() {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="bg-muted/50 h-11 w-16 shrink-0 animate-pulse rounded-xl" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="bg-muted/50 h-4 w-2/3 animate-pulse rounded" />
        <div className="bg-muted/50 h-3 w-1/3 animate-pulse rounded" />
      </div>
      <div className="bg-muted/50 h-9 w-14 shrink-0 animate-pulse rounded-xl" />
    </div>
  )
}

export function ResultsSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-busy aria-label="Loading">
      <div className="flex items-start justify-between gap-3" aria-hidden>
        <div className="space-y-2">
          <div className="bg-muted/50 h-6 w-40 animate-pulse rounded" />
          <div className="bg-muted/50 h-4 w-24 animate-pulse rounded" />
        </div>
        <div className="bg-muted/50 h-10 w-10 animate-pulse rounded-full" />
      </div>
      <div className="space-y-3" aria-hidden>
        <ResultsRow />
        <ResultsRow />
        <ResultsRow />
      </div>
      <span className="sr-only">Loading</span>
    </div>
  )
}
