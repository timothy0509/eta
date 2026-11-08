'use client'

import * as React from 'react'

import { mapRouteStopsToFareIndices, resolveFareVariantForStop } from '@/lib/eta/fares/lookup'
import { formatFareHkd } from '@/lib/eta/format'
import { useFareIndex } from '@/lib/eta/fares/use-fare-index'
import { parseVariantKey } from '@/lib/eta/eta-db-index'
import { fetchKmbRouteStops, fetchKmbStops, type KmbRouteStopLite } from '@/lib/eta/client'
import { useTranslations } from '@/lib/eta/i18n'
import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickLang } from '@/lib/eta/pick-lang'
import { isKmbStop } from '@/lib/eta/types'
import type { UiLanguage } from '@/lib/eta/types'

type FareRow = {
  stopName: string
  hkd: number
}

function matchesVariant(stop: KmbRouteStopLite, variant: ReturnType<typeof parseVariantKey>) {
  if (!variant) return false
  if (
    String(stop.co ?? '').toLowerCase() !== variant.co ||
    String(stop.route ?? '').toUpperCase() !== variant.route ||
    String(stop.bound ?? '') !== variant.bound ||
    String(stop.serviceType ?? '') !== variant.serviceType
  ) {
    return false
  }
  return !variant.gtfsId || String(stop.gtfsId ?? '') === variant.gtfsId
}

/**
 * Fares from one boarding stop to each alighting stage, using the TD GTFS
 * origin/destination matrix. Renders nothing only when the variant has no
 * compiled table or the boarding stop has no fare rows.
 */
export function StopFareTable({
  variantKey,
  stopId,
  lang,
}: {
  variantKey: string
  stopId: string | null
  lang: UiLanguage
}) {
  const fareIndex = useFareIndex()
  const { t, tWithParams } = useTranslations(lang)
  const variant = React.useMemo(() => parseVariantKey(variantKey), [variantKey])
  const fare = React.useMemo(
    () => resolveFareVariantForStop(fareIndex, variantKey, stopId),
    [fareIndex, variantKey, stopId]
  )
  const inputKey = `${variantKey}|${stopId ?? ''}|${lang}`
  const [result, setResult] = React.useState<{ key: string; rows: FareRow[] } | null>(null)
  const rows = result?.key === inputKey ? result.rows : []

  React.useEffect(() => {
    if (!fare || !variant || !stopId) return
    let cancelled = false
    Promise.all([fetchKmbRouteStops(), fetchKmbStops()])
      .then(([routeStops, allStops]) => {
        if (cancelled) return
        const variantStops = routeStops.filter((stop) => matchesVariant(stop, variant))
        const mapping = mapRouteStopsToFareIndices(fare, variantStops)
        const appIndex = variantStops.findIndex((stop) => stop.stopId === stopId)
        // Fall back to the fare table's own stop list when the route-stop
        // projection misses the variant or maps the stop to -1, so a valid
        // ETA row still gets fares.
        const mapped = appIndex >= 0 ? (mapping[appIndex] ?? -1) : -1
        const from = mapped >= 0 ? mapped : fare.stops.indexOf(stopId)
        const ranges = from >= 0 ? (fare.fares[from] ?? []) : []
        if (!ranges || ranges.length === 0) {
          setResult({ key: inputKey, rows: [] })
          return
        }

        const stopById = new Map(allStops.map((stop) => [stop.stopId, stop]))
        const next: FareRow[] = []
        for (const [end, price] of ranges) {
          const destStopId = fare.stops[end]
          if (!destStopId) continue
          const stop = stopById.get(destStopId)
          const fullName = stop
            ? pickLang({ en: stop.nameEn, tc: stop.nameTc, sc: stop.nameSc }, lang)
            : destStopId
          const parsed = stop
            ? parseKmbStopNameCached(fullName, { isKmb: isKmbStop(stop), lang })
            : null
          next.push({
            stopName: parsed?.name ?? fullName,
            hkd: price,
          })
        }
        setResult({ key: inputKey, rows: next })
      })
      .catch(() => {
        if (!cancelled) setResult({ key: inputKey, rows: [] })
      })
    return () => {
      cancelled = true
    }
  }, [fare, variant, stopId, inputKey, lang])

  if (rows.length === 0) return null

  return (
    <section aria-label={t('kmb.faresFromStop')} className="min-w-0">
      <div className="text-on-surface-variant m3-label-md mb-2">{t('kmb.faresFromStop')}</div>
      <ul className="bg-surface-container-high divide-outline-variant/20 divide-y rounded-2xl px-3.5">
        {rows.map((row, index) => (
          <li key={`${row.hkd}:${index}`} className="flex items-center gap-3 py-2">
            <span className="text-on-surface m3-body-md min-w-0 flex-1 truncate">
              {tWithParams('kmb.fareUpTo', { stop: row.stopName })}
            </span>
            <span className="text-on-surface font-tabular m3-body-md shrink-0 font-medium">
              {formatFareHkd(row.hkd)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
