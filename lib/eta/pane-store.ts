'use client'

import { create } from 'zustand'
import type { KmbPaneState } from '@/components/eta/panes/kmb-pane'
import type { MtrPaneState } from '@/components/eta/panes/mtr-pane'
import type { LrtPaneState } from '@/components/eta/panes/lrt-pane'
import type { CompanyChip } from '@/lib/eta/company-filter'
import type { KmbStopSearchItem } from '@/lib/eta/types'

type PaneStore = {
  kmb: KmbPaneState | null
  mtr: MtrPaneState | null
  lrt: LrtPaneState | null
  kmbStops: KmbStopSearchItem[]
  setKmbStops: (stops: KmbStopSearchItem[]) => void
  /** Transient company chip selection for the KMB stop card. Not persisted. */
  companyChip: CompanyChip
  setCompanyChip: (chip: CompanyChip) => void
  /** Transient quick-hop selection for the KMB stop card. Not persisted. */
  quickHopStopId: string | null
  setQuickHopStopId: (stopId: string | null) => void
  /** Transient sort-by-time toggle shared by the ETA cards. Not persisted. */
  sortByTime: boolean
  setSortByTime: (value: boolean) => void
  /** Transient dismissed traffic alert ids for the home banner. Not persisted. */
  dismissedAlertIds: string[]
  dismissAlert: (id: string) => void
}

export const usePaneStore = create<PaneStore>()((set) => ({
  kmb: null,
  mtr: null,
  lrt: null,
  kmbStops: [],
  setKmbStops: (stops) => set({ kmbStops: stops }),
  companyChip: 'all',
  setCompanyChip: (chip) => set({ companyChip: chip }),
  quickHopStopId: null,
  setQuickHopStopId: (stopId) => set({ quickHopStopId: stopId }),
  sortByTime: false,
  setSortByTime: (value) => set({ sortByTime: value }),
  dismissedAlertIds: [],
  dismissAlert: (id) =>
    set((state) =>
      state.dismissedAlertIds.includes(id)
        ? state
        : { dismissedAlertIds: [...state.dismissedAlertIds, id] }
    ),
}))
