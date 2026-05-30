import * as React from 'react'

import { LRT_STATIONS } from '@/lib/data/lrt-stations'
import { MTR_STATIONS } from '@/lib/data/mtr-stations'
import type { LrtStationSearchItem, MtrStationSearchItem } from '@/lib/eta/types'

export function useHomeStations() {
  const mtrStations: MtrStationSearchItem[] = React.useMemo(
    () =>
      MTR_STATIONS.map((s) => ({
        labelId: s.sta,
        sta: s.sta,
        lines: [...s.lines],
        nameEn: s.nameEn,
        nameTc: s.nameTc,
      })),
    []
  )

  const lrtStations: LrtStationSearchItem[] = React.useMemo(
    () =>
      LRT_STATIONS.map((s) => ({
        stationId: s.stationId,
        nameEn: s.nameEn,
        nameZh: s.nameZh,
      })),
    []
  )

  return { mtrStations, lrtStations }
}
