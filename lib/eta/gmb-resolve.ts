import type { Company, RouteListEntry } from 'hk-bus-eta'

import {
  gmbRouteSeqToBound,
  type GmbTdRouteSeq,
  type GmbTdStopPoint,
} from '@/lib/eta/direct/gmb-td'
import { normalizeBound, type EtaDbIndexes } from '@/lib/eta/eta-db-index'

export type GmbEtaResolution = {
  entry: RouteListEntry
  co: Company
  bound: string
  serviceType: string
  /** True when several realtime variants matched and the closest was picked. */
  ambiguous: boolean
  candidateCount: number
}

export type GmbStopQuery = {
  tdStop: GmbTdStopPoint
  /** hk-bus-eta stop id at the same sequence position, null when unresolvable. */
  etaStopId: string | null
  /** 0-based sequence into the realtime variant's stop list. */
  seq: number
  unresolved: boolean
}

function entryBoundFor(entry: RouteListEntry, co: Company): string {
  return normalizeBound(entry.bound[co])
}

/**
 * Match a TD GMB variant to a hk-bus-eta realtime variant by
 * (co=gmb, route number, bound from routeSeq, serviceType). TD stopIds live
 * in TD's own namespace and are never used for matching.
 */
export function resolveGmbEtaVariant(params: {
  routeName: string
  routeSeq: GmbTdRouteSeq
  tdStopCount: number
  indexes: Pick<EtaDbIndexes, 'kmbRouteListEntries'>
}): GmbEtaResolution | null {
  const wantedRoute = params.routeName.trim().toUpperCase()
  if (!wantedRoute) return null
  const wantedBound = gmbRouteSeqToBound(params.routeSeq)

  const candidates = params.indexes.kmbRouteListEntries.filter((entry) => {
    if (!entry.co.includes('gmb')) return false
    if (entry.route.trim().toUpperCase() !== wantedRoute) return false
    const bound = entryBoundFor(entry, 'gmb')
    return bound === wantedBound || bound === 'OI' || bound === 'IO'
  })
  if (candidates.length === 0) return null

  const exact = candidates.filter((entry) => entryBoundFor(entry, 'gmb') === wantedBound)
  const pool = exact.length > 0 ? exact : candidates
  const sorted = [...pool].sort((a, b) => {
    const aLen = a.stops.gmb?.length ?? 0
    const bLen = b.stops.gmb?.length ?? 0
    return (
      Math.abs(aLen - params.tdStopCount) - Math.abs(bLen - params.tdStopCount) ||
      a.serviceType.localeCompare(b.serviceType)
    )
  })
  const entry = sorted[0]
  if (!entry) return null

  return {
    entry,
    co: 'gmb',
    bound: entryBoundFor(entry, 'gmb'),
    serviceType: entry.serviceType,
    ambiguous: candidates.length > 1,
    candidateCount: candidates.length,
  }
}

/**
 * Map TD stops (already in stopSeq order) onto realtime queries by sequence
 * position. Stops past the end of the realtime stop list are flagged
 * unresolved instead of guessed.
 */
export function resolveGmbStopQueries(
  tdStops: GmbTdStopPoint[],
  resolution: GmbEtaResolution | null
): GmbStopQuery[] {
  const etaStops = resolution?.entry.stops.gmb ?? []
  return tdStops.map((tdStop, index) => {
    const etaStopId = resolution ? (etaStops[index] ?? null) : null
    return {
      tdStop,
      etaStopId,
      seq: index,
      unresolved: etaStopId === null,
    }
  })
}

/** Variant key shared with the KMB ETA filter (`co|route|bound|serviceType`). */
export function gmbVariantBaseKey(resolution: GmbEtaResolution, routeName: string): string {
  return `gmb|${routeName.trim().toUpperCase()}|${resolution.bound}|${resolution.serviceType}`
}
