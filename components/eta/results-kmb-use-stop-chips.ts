import * as React from 'react'

import { parseKmbStopNameCached } from '@/lib/eta/kmb-stop-name'
import { pickStopName } from '@/components/eta/results-kmb-utils'
import type { KmbEtaEntryWithLeg } from '@/lib/eta/client'
import type { UiLanguage } from '@/lib/eta/types'

export type StopChips = {
  stopId: string | null
  fullName: string | null
  name: string | null
  platform: string | null
  stopCode: string | null
}

export type StopInfo = {
  stopId: string
  nameEn: string
  nameTc: string
  nameSc: string
}

export function useStopChips(stops: StopInfo[] | undefined, lang: UiLanguage) {
  const stopLookup = React.useMemo(() => {
    if (!stops) return new Map<string, StopInfo>()
    return new Map(stops.map((s) => [s.stopId, s]))
  }, [stops])

  const stopChipsByIdRef = React.useRef(new Map<string, StopChips>())

  // Rebuild cache when stops or lang change
  React.useEffect(() => {
    stopChipsByIdRef.current.clear()
    if (!stops) return
    for (const stop of stops) {
      const fullName = pickStopName(stop, lang)
      const parsed = parseKmbStopNameCached(fullName)
      stopChipsByIdRef.current.set(stop.stopId, {
        stopId: stop.stopId,
        fullName,
        name: parsed.name ?? fullName,
        platform: parsed.platform ?? null,
        stopCode: parsed.stopCode ?? null,
      })
    }
  }, [stops, lang])

  const getStopChips = React.useCallback(
    (items: KmbEtaEntryWithLeg[]): StopChips => {
      const stopId = items[0]?.stop ? String(items[0].stop).trim() : null

      if (stopId) {
        const cached = stopChipsByIdRef.current.get(stopId)
        if (cached) return cached
      }

      const stopFromEta = stopId ? stopLookup.get(stopId) : undefined
      const stopFromBuiltInId = !stopFromEta && stopId ? stopLookup.get(stopId) : undefined

      const stop = stopFromEta ?? stopFromBuiltInId
      const fullName = stop ? pickStopName(stop, lang) : null
      const parsed = fullName ? parseKmbStopNameCached(fullName) : null

      const result: StopChips = {
        stopId,
        fullName,
        name: parsed?.name ?? fullName ?? null,
        platform: parsed?.platform ?? null,
        stopCode: parsed?.stopCode ?? null,
      }

      if (stopId) stopChipsByIdRef.current.set(stopId, result)

      return result
    },
    [stopLookup, lang]
  )

  return { stopLookup, getStopChips }
}
