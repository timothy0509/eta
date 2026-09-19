import * as React from 'react'

import { cn } from '@/lib/utils'

/**
 * Index-based entrance delay class. Replaces the `idx === 0 ? ...`
 * ternary chain that was copy-pasted across every results view.
 * Only the first five items stagger; the rest render immediately
 * so long lists do not feel sluggish.
 *
 * Replay rule: list containers key on the query signature (stop ids,
 * route key, station id), never on live ETA arrays. A new search
 * remounts and replays the stagger, a data refresh keeps the same
 * key and rows stay still.
 */
export function staggerClassForIndex(idx: number): string {
  if (idx === 0) return 'ui-stagger-1'
  if (idx === 1) return 'ui-stagger-2'
  if (idx === 2) return 'ui-stagger-3'
  if (idx === 3) return 'ui-stagger-4'
  if (idx === 4) return 'ui-stagger-5'
  return ''
}

type Props = {
  children: React.ReactNode
  className?: string
}

/** Vertical stack that applies the shared stagger rhythm to lists. */
export function StaggerList({ children, className }: Props) {
  return <div className={cn('space-y-2', className)}>{children}</div>
}
