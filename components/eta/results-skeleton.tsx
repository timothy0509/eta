import * as React from 'react'

import { Card, CardContent } from '@/components/ui/card'

export function ResultsSkeleton() {
  return (
    <Card className="bg-card/60 rounded-3xl border p-0 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-muted/50 h-24 animate-pulse rounded-2xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
