import * as React from 'react'

export function ResultsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <div className="bg-muted/50 h-6 w-40 animate-pulse rounded" />
          <div className="bg-muted/50 h-4 w-24 animate-pulse rounded" />
        </div>
        <div className="bg-muted/50 h-10 w-10 animate-pulse rounded-full" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-muted/50 h-24 animate-pulse rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
