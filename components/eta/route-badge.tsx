'use client'

import { cn } from '@/lib/utils'
import { getLineColor } from '@/lib/eta/line-colors'
import { getRouteBadgeStyle } from '@/lib/eta/route-badge'

type Props = {
  route: string
  company?: string
  mode?: string
  lineCode?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

/**
 * Signal RouteBadge v2: mode-aware, CJK-safe, min 44px wide and 28px tall.
 * Operator paint stays verbatim. MTR/LRT rail uses the line color.
 */
export function RouteBadge({ route, company, mode, lineCode, size = 'md', className }: Props) {
  const style = getRouteBadgeStyle(route, company)
  const rail = lineCode ? getLineColor(lineCode) : null
  const label = mode ? `${mode.toUpperCase()} route ${route}` : `Route ${route}`

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs min-h-[28px]',
    md: 'px-2.5 py-1 text-sm min-h-[28px]',
    lg: 'px-3 py-1 text-base min-h-[32px]',
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={route}
      className={cn(
        'rounded-badge inline-flex max-w-[96px] min-w-[44px] shrink-0 items-center justify-center gap-1 overflow-hidden border px-2.5 font-sans font-bold whitespace-nowrap',
        sizeClasses[size],
        className
      )}
      style={{
        color: style.textColor,
        backgroundColor: style.bgColor,
        borderColor: style.bgColor === '#FFFFFF' ? '#D1D5DB' : style.bgColor,
      }}
    >
      {rail ? (
        <span
          aria-hidden
          className="h-3 w-1 shrink-0 rounded-full"
          style={{ backgroundColor: rail }}
        />
      ) : null}
      <span className="truncate">{route}</span>
    </span>
  )
}
