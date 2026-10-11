'use client'

import * as React from 'react'

import { resolveTdRouteLine } from '@/lib/eta/direct/td-route-lines'
import type { GeoPoint } from '@/lib/eta/geo'

/**
 * True road-following shape from the CSDI route lines (franchised bus and
 * GMB layers), matched by route name, company, and stop endpoints. Replaces
 * car-profile OSRM routing, which drew buses along the wrong roads. Returns
 * null for variants with no fitting line so callers fall back to
 * stop-sequence lines.
 */
export function useTdRouteLine(
  variant: { key: string; route: string; co: string; bound: string } | null,
  points: GeoPoint[]
): GeoPoint[] | null {
  const [result, setResult] = React.useState<{ key: string; path: GeoPoint[] } | null>(null)

  React.useEffect(() => {
    if (!variant || points.length < 2) return
    let cancelled = false
    resolveTdRouteLine({
      route: variant.route,
      co: variant.co,
      bound: variant.bound,
      variantPoints: points,
    })
      .then((line) => {
        if (!cancelled && line) setResult({ key: variant.key, path: line.points })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [variant, points])

  return result && variant && result.key === variant.key ? result.path : null
}
