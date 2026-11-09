import * as React from 'react'

import { fetchKmbFares, type KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { Company } from 'hk-bus-eta'

/**
 * Manages background fare fetching for KMB ETAs.
 * Fares are fetched separately from ETAs for faster initial load.
 */
export function useKmbFares(
  dispatchEta: React.Dispatch<{
    type: 'FARES_SUCCESS'
    payload: {
      faresByVariantKey: Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
    }
  }>,
  faresByVariantKeyRef: React.MutableRefObject<
    Record<string, { hkd: number; dayCode?: number; source: 'hk-bus-eta' }>
  >
) {
  return React.useCallback(
    (filteredByStopId: Record<string, KmbEtaEntryWithLeg[]>, signal?: AbortSignal) => {
      const allEtas = Object.entries(filteredByStopId).flatMap(([stopId, etas]) =>
        etas.map((eta) => ({ stopId, eta }))
      )
      const seenVariants = new Set<string>()
      const fareVariants: {
        co: Company
        route: string
        dir: string
        serviceType: string
        gtfsId?: string
        jointVariantKey?: string
        stopId: string
        destCandidates: string[]
      }[] = []

      for (const { eta } of allEtas) {
        // Match the grouped display base key: joint rows canonicalize under
        // groupCo with the joint scope.
        const co = String(eta.groupCo ?? eta.co ?? 'kmb') as Company
        const route = (eta.route ?? '').toUpperCase()
        const dir = String(eta.dir ?? '')
        const serviceType = String(eta.service_type ?? '')
        const gtfsId = String(eta.gtfsId ?? '').trim()
        const jointVariantKey = String(eta.jointVariantKey ?? '').trim()
        const scope = jointVariantKey || gtfsId
        const vKey = scope
          ? `${co}|${route}|${dir}|${serviceType}|${scope}`
          : `${co}|${route}|${dir}|${serviceType}`

        if (faresByVariantKeyRef.current[vKey] || seenVariants.has(vKey)) continue
        seenVariants.add(vKey)

        fareVariants.push({
          co,
          route,
          dir,
          serviceType,
          gtfsId,
          jointVariantKey,
          stopId: String(eta.stop ?? ''),
          destCandidates: [eta.dest_en, eta.dest_tc, eta.dest_sc].filter(Boolean) as string[],
        })
      }

      if (fareVariants.length > 0 && !signal?.aborted) {
        fetchKmbFares(fareVariants, { signal })
          .then((faresResult) => {
            if (!signal?.aborted) {
              dispatchEta({
                type: 'FARES_SUCCESS',
                payload: { faresByVariantKey: faresResult.faresByVariantKey },
              })
            }
          })
          .catch((err) => {
            if (!signal?.aborted) {
              console.warn('Failed to load fares:', err)
            }
          })
      }
    },
    [dispatchEta, faresByVariantKeyRef]
  )
}
